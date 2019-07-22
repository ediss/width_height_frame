var width = innerWidth;

var slideout = new Slideout({
	'panel': document.getElementById('main'),
	'menu': document.getElementById('menu'),
	'padding': width,
	'tolerance': 70,
	'easing': 'ease-out',
	'touch': false,
	// ---- Animation duration in ms (default 300ms) ----
	// 'duration': 400
});

document.querySelector('.js-slideout-open').addEventListener('click', function () {
	slideout.open();
});

document.querySelector('.js-slideout-close').addEventListener('click', function () {
	slideout.close();
});
