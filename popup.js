(function () {
	chrome.runtime.sendMessage('ratePopupOpened');


	var starClicked = false;
	var storeReviewPageOpened = false;
	var rateEl = document.querySelector('#rating-ask');
	var allStars = rateEl.querySelectorAll('#rating-ask .stars a');
	var ratingAskText = rateEl.querySelector('.ext_text');
	var over = false;

	ratingAskText.innerText = chrome.i18n.getMessage('rate_us_popup');

	/**
	 *
	 * @param event
	 * @param details
	 */
	function trackEvent (event, details) {
		var send = {
			action: 'trackEvent',
			event: event
		};
		if(typeof(details)!=='undefined'){ send.details = JSON.stringify(details); }
		chrome.runtime.sendMessage(send);
	}

	if(allStars && allStars.forEach){
		allStars.forEach(function (el) {
			el.querySelector('.empty').style.display = 'inline';
			el.querySelector('.filled').style.display = 'none';
		});
	} else{
		return;
	}

	function onOver(e) {
		over = true;
		var pos = this.dataset.pos;
		allStars.forEach(function (el) {
			if (el.dataset.pos <= pos) {
				el.querySelector('.empty').style.display = 'none';
				el.querySelector('.filled').style.display = 'inline';
			} else {
				el.querySelector('.empty').style.display = 'inline';
				el.querySelector('.filled').style.display = 'none';
			}
		})
	}

	function onOut(e) {
		if (starClicked) {
			return;
		}
		over = false;
		setTimeout(function () {
			if (over) {
				return;
			}
			allStars.forEach(function (el) {
				el.querySelector('.empty').style.display = 'inline';
				el.querySelector('.filled').style.display = 'none';
			})
		}, 100);
	}

	function onClick(e) {
		starClicked = true;
		var pos = this.dataset.pos;
		allStars.forEach(function (el) {
			if (el.dataset.pos <= pos) {
				el.querySelector('.empty').style.display = 'none';
				el.querySelector('.filled').style.display = 'inline';
			}
		});
		allStars.forEach(function (el) {
			el.removeEventListener('mouseover', onOver);
			el.removeEventListener('mouseout', onOut);
			el.removeEventListener('click', onClick);
		});

		chrome.runtime.sendMessage({action: 'user_popup_rate', value: pos});
		trackEvent('user_popup_rate', {value: pos});

		if (pos > 3 && !storeReviewPageOpened) {
			chrome.tabs.create({url: 'https://chrome.google.com/webstore/detail/vimeo-video-downloader/lieleokakhofondondkehlhghhbadcch/reviews'});
		} else {
			ratingAskText.innerText = chrome.i18n.getMessage('your_rate');
		}
	}

	allStars.forEach(function (el) {
		el.addEventListener('mouseover', onOver);
		el.addEventListener('mouseout', onOut);
		el.addEventListener('click', onClick);
	});

})();