{
	"translatorID": "3dcbb947-f7e3-4bbd-a4e5-717f3701d624",
	"label": "HeinOnline",
	"creator": "Frank Bennett",
	"target": "https?://heinonline.org/HOL/(?:LuceneSearch|Page)\\?",
	"minVersion": "1.0",
	"maxVersion": "",
	"priority": 100,
	"inRepository": true,
	"translatorType": 4,
	"browserSupport": "gcsbv",
	"lastUpdated": "2016-02-22 23:08:21"
}

/*
 *** Utility Functions ***
*/

// Get any search results from current page
// Used in detectWeb() and doWeb()
function getSearchResults(doc, url) {
	var results = doc.getElementsByClassName("lucene_search_result_b"),
		items = {},
		found = false
	for (var i=0, ilen=results.length; i<ilen; i++) {
		var url = getXPathStr("href", results[i], './/a[contains(@href, "Page")]');

		var title = getXPathStr("textContent", results[i], './/a[1]/b');
		title = ZU.trimInternal(title);
		title = title.replace(/\s*\[[^\]]*\]$/, '');

		if (!title || !url) continue;
		
		items[url] = title;
		found = true;
	}
	return found ? items : false;
}

// Get the string value of the first object matching XPath
function getXPathStr(attr, elem, path) {
	var res = ZU.xpath(elem, path);
	res = res.length ? res[0][attr] : '';
	return res ? res : '';
}

// Extract query values to keys on an object
function extractQueryValues(url) {
	var ret = {};
	ret.base = url.replace(/(.*?)[a-zA-Z]+\?.*/, "$1");
	var query = url.replace(/.*?\?/, "");
	query = query.split("&");
	for (var i=0,ilen=query.length;i<ilen;i++) {
		let pair = query[i].split("=");
		ret[pair[0]] = pair[1];
	}
	return ret;
}

// Remangle HeinOnline RIS to form expected by translator
function fixRIS (ris) {
	var lines = ris.split("\n");
	for (var i=0,ilen=lines.length;i<ilen;i++) {
		lines[i] = lines[i].replace(/^([A-Z0-9][A-Z0-9]) /, "$1  - ");
		lines[i] = lines[i].replace(/^VO  /, "VL  ");
		lines[i] = lines[i].replace(/^YR  /, "DA  ");
		lines[i] = lines[i].replace(/^OP  /, "EP  ");
	}
	ris = lines.join("\n");
	return ris;
}

// Not all pages have a downloadable PDF
function translatePage(ris, pdfURL) {
	var trans = Zotero.loadTranslator('import');
	trans.setTranslator('32d59d2d-b65a-4da4-b0a3-bdd3cfb979e7');//https://github.com/zotero/translators/blob/master/RIS.js
	trans.setString(ris);
	if (pdfURL) {
		trans.setHandler('itemDone', function (obj, item) {
			item.attachments = [{
				title: "HeinOnline PDF",
				url: pdfURL,
				mimeType: "application/pdf"
			}];
			item.complete();
		});
	} else {
		trans.setHandler('itemDone', function (obj, item) {
			item.complete();
		});
	}
	trans.translate();
}

// Build URL for RIS, and for PDF if available
function scrapePage(doc, url) {
	var risPopupURL = getXPathStr("href", doc, '//form[@id="pagepicker"]//a[contains(@href, "PrintRequest")][1]');
	var docParams = extractQueryValues(risPopupURL);
	var risURL = docParams.base + "CitationFile?kind=ris&handle=" + docParams.handle + "&div=" + docParams.div + "&id=" + docParams.id + "&base=js";

	var pdfPageURL = getXPathStr("href", doc, '//a[contains(@class, "updatediv")]');

	ZU.doGet(risURL, function(ris) {
		ris = fixRIS(ris);
		if (pdfPageURL) {
			ZU.doGet(pdfPageURL, function(pdfPage) {
				// Call to pdfPageURL prepares PDF for download via META refresh URL
				pdfURL = null;
				var m = pdfPage.match(/<META.*URL=([^\"]+)/);
				if (m) {
					var pdfURL = m[1];
				}
				translatePage(ris, pdfURL);
			} , null , "UTF-8");
		} else {
			translatePage(ris);
		}
	} , null , "UTF-8");

}

function detectWeb (doc, url) {
	if (url.indexOf("/LuceneSearch?") > -1) {
		if (getSearchResults(doc)) {
			return "multiple";
		}
	} else {
		return "journalArticle";
	}
	return false;
}

function doWeb (doc, url) {
	if (detectWeb(doc, url) === "multiple") {
		Zotero.selectItems(getSearchResults(doc, url), function (items) {
			if (!items) {
				return true;
			}
			var urls = [];
			for (var i in items) {
				urls.push(i);
			}
			ZU.processDocuments(urls, scrapePage);
		});
	} else {
		scrapePage(doc, url);
	}
}

/** BEGIN TEST CASES **/
var testCases = [
	{
		"type": "web",
		"url": "http://heinonline.org/HOL/Page?handle=hein.journals/howlj3&div=8&collection=journals&set_as_cursor=1&men_tab=srchresults",
		"items": [
			{
				"itemType": "journalArticle",
				"title": "Law, Logic and Experience Leading Article",
				"creators": [
					{
						"lastName": "Gilmore",
						"firstName": "Grant",
						"creatorType": "author"
					}
				],
				"date": "1957",
				"journalAbbreviation": "Howard L.J.",
				"language": "eng",
				"libraryCatalog": "HeinOnline",
				"pages": "26-41",
				"publicationTitle": "Howard Law Journal",
				"volume": "3",
				"attachments": [
					{
						"title": "HeinOnline PDF",
						"mimeType": "application/pdf"
					}
				],
				"tags": [],
				"notes": [],
				"seeAlso": []
			}
		]
	}
]
/** END TEST CASES **/