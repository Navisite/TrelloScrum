/*
** TrelloScrum v0.56 - https://github.com/Q42/TrelloScrum
** Adds Scrum to your Trello
**
** Original:
** Jasper Kaizer <https://github.com/jkaizer>
** Marcel Duin <https://github.com/marcelduin>
**
** Contribs:
** Paul Lofte <https://github.com/paullofte>
** Nic Pottier <https://github.com/nicpottier>
** Bastiaan Terhorst <https://github.com/bastiaanterhorst>
** Morgan Craft <https://github.com/mgan59>
** Frank Geerlings <https://github.com/frankgeerlings>
**
*/

//default story point picker sequence
var _pointSeq = [0, '.5', 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];

//internals
var filtered = false, //watch for filtered cards
	reg = /\((\x3f|\d*\.?\d+)\)\s?/m, //parse regexp- accepts digits, decimals and '?'
	iconUrl = chrome.extension.getURL('images/storypoints-icon.png');

//what to do when DOM loads
$(function(){
	$(".js-filter-cards").click(function () {
		setTimeout("insertStories()", 50);
	});

	//watch filtering
	$('.js-filter-toggle').live('mouseup',function(e){
		setTimeout(function(){
			filtered=$('.js-filter-cards').hasClass('is-on');
			calcPoints()
		})
	});

	//for storypoint picker
	$(".card-detail-title .edit-controls").live('DOMNodeInserted',showPointPicker);
	
	$('body').bind('DOMSubtreeModified',function(e){
		if($(e.target).hasClass('list'))
			readList($(e.target))
	});

	$('.js-share').live('mouseup',function(){
		setTimeout(checkExport)
	});

	function readList($c){
		$c.each(function(){
			if(!this.list) new List(this);
			else if(this.list.calc) this.list.calc();
		})
	};

	readList($('.list'));

});

jQuery.fn.reverse = [].reverse;

function insertStories() {
	//	console.log('insertStories');

	//Make sure this is a sprint board	
	if ($('.list-area h2:eq(0)').text().search('Stories') != -1) {
		//Remove label Filters
		$('.filter-label-toggle').each(function () {$(this).parent().remove()});

		//Add stories to the list
		$('.list:eq(0) .list-card-title').reverse().each(function () {
			var story = $(this).text();
			var story_match = story.match(/\[[0-9]*\]/);
			if (story_match != null) {
				var story_id = story_match[0].slice(1,-1);
				insertStory(story, story_id);
			}
		});

		//Attach click
		$('.filter-by-story').click(function () {
			filterCards($(this).attr('attr'));
		});
	}
}

function insertStory(txt, num) {
	//	console.log('insertStory: ' + txt + '-' + num);

	var html = '<li> <a href="#" class="js-filter-toggle filter-by-story clearfix" attr="['+num+']"> <span class="title">   <span>'+txt+'</span>  </span> <span class="app-icon small-icon light close-icon"></span> </a> </li>';
	$('.card-filter li').eq(0).after(html);
}

function filterCards(val) {
	//	console.log('filterCards: ' + val);

	setTimeout("runInPage(\"$('.js-filter-by-title').val('"+val+"').keyup()\")", 5);
	setTimeout("$('.filter-by-story').removeClass('active')", 10);
}

//Hack to allow us to trigger the keyup
function runInPage(code) {
	var script = document.createElement('script');
	script.innerHTML = code;
 	document.documentElement.insertBefore(script);
}

//.list pseudo
function List(el){
	if(el.list)return;
	el.list=this;

	var $list=$(el),
		busy = false,
		to,
		to2;

	var $total=$('<span class="list-total">')
		.bind('DOMNodeRemovedFromDocument',function(){
			clearTimeout(to);
			to=setTimeout(function(){
				$total.appendTo($list.find('.list-header h2'))
			})
		})
		.appendTo($list.find('.list-header h2'));

	$list.bind('DOMNodeInserted',function(e){
		if($(e.target).hasClass('list-card') && !e.target.listCard) {
			clearTimeout(to2);
			to2=setTimeout(readCard,0,$(e.target))
		}
	});

	function readCard($c){
		$c.each(function(){
			if($(this).hasClass('placeholder')) return;
			if(!this.listCard) new ListCard(this)
		})
	};

	this.calc = function(){
		var score=0;
		$list.find('.list-card').each(function(){if(this.listCard && !isNaN(Number(this.listCard.points)))score+=Number(this.listCard.points)});
		var scoreTruncated = Math.floor(score * 100) / 100;
		$total.text(scoreTruncated>0?scoreTruncated:'')
	};

	readCard($list.find('.list-card'))
};

//.list-card pseudo
function ListCard(el){
	if(el.listCard)return;
	el.listCard=this;

	var points=-1,
		parsed,
		that=this,
		busy=false,
		busy2=false,
		to,
		to2,
		ptitle,
		$card=$(el)
			.bind('DOMNodeInserted',function(e){
				if(!busy && ($(e.target).hasClass('list-card-title') || e.target==$card[0])) {
					clearTimeout(to2);
					to2=setTimeout(getPoints);
				}
			}),
		$badge=$('<div class="badge badge-points point-count" style="background-image: url('+iconUrl+')"/>')
			.bind('DOMSubtreeModified DOMNodeRemovedFromDocument',function(e){
				if(busy2)return;
				busy2=true;
				clearTimeout(to);
				to = setTimeout(function(){
					$badge.prependTo($card.find('.badges'));
					busy2=false;
				});
			});

	function getPoints(){
		var $title=$card.find('a.list-card-title');
		if(!$title[0]||busy)return;
		busy=true;
		var title=$title[0].text;
		parsed=title.match(reg);
		points=parsed?parsed[1]:-1;
		if($card.parent()[0]){
			$title[0].textContent = title.replace(reg,'');
			$badge.text(that.points);
			$badge.attr({title: 'This card has '+that.points+' storypoint' + (that.points == 1 ? '.' : 's.')})
		}
		busy=false;
	};

	this.__defineGetter__('points',function(){
		//don't add to total when filtered out
		return parsed&&(!filtered||($card.css('opacity')==1 && $card.css('display')!='none'))?points:''
	});

	getPoints()
};

//forcibly calculate list totals
function calcPoints($el){
	($el||$('.list')).each(function(){if(this.list)this.list.calc()})
};

//the story point picker
function showPointPicker() {
	if($(this).find('.picker').length) return;
	var $picker = $('<div class="picker">').appendTo('.card-detail-title .edit-controls');
	for (var i in _pointSeq) $picker.append($('<span class="point-value">').text(_pointSeq[i]).click(function(){
		var value = $(this).text();
		var $text = $('.card-detail-title .edit textarea');
		var text = $text.val();

		// replace our new
		$text[0].value=text.match(reg)?text.replace(reg, '('+value+') '):'('+value+') ' + text;

		// then click our button so it all gets saved away
		$(".card-detail-title .edit .js-save-edit").click();

		return false
	}))
};

//for export
var $excel_btn,$excel_dl;
window.URL = window.webkitURL || window.URL;
window.BlobBuilder = window.BlobBuilder || window.WebKitBlobBuilder || window.MozBlobBuilder;

function checkExport() {
	if($('form').find('.js-export-excel').length) return;
	var $js_btn = $('form').find('.js-export-json');
	if($js_btn.length)
		$excel_btn = $('<a>')
			.attr({
				style: 'margin: 0 4px 4px 0;',
				class: 'button js-export-excel',
				href: '#',
				target: '_blank',
				title: 'Open downloaded file with Excel'
			})
			.text('Excel')
			.click(showExcelExport)
			.insertAfter($js_btn);
}

function showExcelExport() {
	$excel_btn.text('Generating...');

	$.getJSON($('form').find('.js-export-json').attr('href'), function(data) {
		var s = '<table id="export" border=1>';
		s += '<tr><th>Points</th><th>Story</th><th>Description</th></tr>';
		$.each(data['lists'], function(key, list) {
			var list_id = list["id"];
			s += '<tr><th colspan="3">' + list['name'] + '</th></tr>';

			$.each(data["cards"], function(key, card) {
				if (card["idList"] == list_id) {
					var title = card["name"];
					var parsed = title.match(reg);
					var points = parsed?parsed[1]:'';
					title = title.replace(reg,'');
					s += '<tr><td>'+ points + '</td><td>' + title + '</td><td>' + card["desc"] + '</td></tr>';
				}
			});
			s += '<tr><td colspan=3></td></tr>';
		});
		s += '</table>';

		var bb = new BlobBuilder();
		bb.append(s);
		
		var board_title_reg = /.*\/board\/(.*)\//;
		var board_title_parsed = document.location.href.match(board_title_reg);
		var board_title = board_title_parsed[1];

		$excel_btn
			.text('Excel')
			.after(
				$excel_dl=$('<a>')
					.attr({
						download: board_title + '.xls',
						href: window.URL.createObjectURL(bb.getBlob('application/ms-excel'))
					})
			);

		var evt = document.createEvent('MouseEvents');
		evt.initMouseEvent('click', true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
		$excel_dl[0].dispatchEvent(evt);
		$excel_dl.remove()

	});

	return false
};
