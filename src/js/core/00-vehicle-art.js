function vehicleRangerSvg(color) {
  const paint = /^#[0-9a-f]{6}$/i.test(color || '') ? color : '#e7e9ed';
  const wheel = x => '<g transform="translate(' + x + ' 155)"><circle r="33" fill="#101116"/><circle r="28" fill="#202229"/><circle r="21" fill="#aab0ba"/><circle r="16" fill="#3a3f48"/>' + [0, 60, 120, 180, 240, 300].map(a => '<path d="M-3-5-5-18H5L3-5Z" fill="#bfc5ce" transform="rotate(' + a + ')"/>').join('') + '<circle r="7" fill="#8b939e"/><circle r="3" fill="#323740"/></g>';
  return '<svg class="ranger-art" viewBox="0 0 480 210" role="img" aria-label="Ford Ranger XLT double-cab illustration">' +
    '<defs><linearGradient id="ranger-paint" x2="0" y2="1"><stop stop-color="' + paint + '"/><stop offset="1" stop-color="' + paint + '" stop-opacity=".86"/></linearGradient></defs>' +
    '<ellipse cx="240" cy="190" rx="211" ry="9" fill="#000" opacity=".3"/>' +
    '<path d="M26 94Q26 87 34 87H170L185 55Q191 43 208 43H286Q305 43 321 62L354 91 431 102Q448 105 451 123V151H426A40 40 0 0 0 346 151H150A40 40 0 0 0 70 151H26Z" fill="url(#ranger-paint)" stroke="#9299a4" stroke-width="1.4"/>' +
    '<path d="M29 126H72M150 126H347M426 126H447" stroke="#000" opacity=".15" stroke-width="13"/>' +
    '<path d="M196 54H252V89H183ZM266 54H285Q298 54 311 68L330 89H266Z" fill="#243441" stroke="#79828b" stroke-width="2"/>' +
    '<path d="M201 58H247M270 58H285L318 84" stroke="#a5b9ca" opacity=".25" stroke-width="3"/>' +
    '<path d="M174 89V145M259 91V145M332 93V144" stroke="#555d69" opacity=".65"/><path d="M186 145H328" stroke="#fff" opacity=".4"/>' +
    '<rect x="28" y="82" width="143" height="7" rx="2" fill="#252932"/><rect x="180" y="151" width="151" height="10" rx="4" fill="#20252d"/><path d="M186 153H326" stroke="#a2a9b2" stroke-width="2"/>' +
    '<path d="M70 153A40 40 0 0 1 150 153M346 153A40 40 0 0 1 426 153" fill="none" stroke="#252a32" stroke-width="9"/>' +
    '<rect x="213" y="99" width="19" height="5" rx="2" fill="#313740"/><rect x="293" y="99" width="19" height="5" rx="2" fill="#313740"/><rect x="328" y="83" width="25" height="13" rx="5" fill="#343a44"/><path d="M333 86H348" stroke="#c6ccd4" stroke-width="3"/>' +
    '<rect x="27" y="100" width="9" height="23" rx="2" fill="#d63e49"/><rect x="28" y="110" width="7" height="5" fill="#e6d9da"/><path d="M415 109 439 113 441 123H416Z" fill="#f5eccb" stroke="#535b64"/><rect x="439" y="126" width="12" height="20" rx="2" fill="#222832"/><path d="M441 131H449M441 137H449" stroke="#929aa5"/><rect x="23" y="141" width="21" height="11" rx="3" fill="#252a33"/>' +
    '<path d="M338 105H353L351 116H339Z" fill="#29313b"/><text x="340" y="113" fill="#cbd1d9" font-family="sans-serif" font-size="6" font-weight="700">XLT</text>' + wheel(110) + wheel(386) + '</svg>';
}
