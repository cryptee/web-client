////////////////////////////////////////////////
////////////////////////////////////////////////
//	SEARCH
////////////////////////////////////////////////
////////////////////////////////////////////////




////////////////////////////////////////////////
////////////////////////////////////////////////
//	INIT
////////////////////////////////////////////////
////////////////////////////////////////////////

var searchTimer, searchKeydownTimer;

var searchArray = [];

var searchOptions = {
    shouldSort: true,
    threshold: 0.4,
    location: 0,
    distance: 100,
    maxPatternLength: 32,
    minMatchCharLength: 2,
    includeMatches: true,
    useExtendedSearch: true,
    includeScore: true,
    keys: [ "name" ]
};



////////////////////////////////////////////////
////////////////////////////////////////////////
//	SEARCH VARIABLES
////////////////////////////////////////////////
////////////////////////////////////////////////

var browserTimezone;
try { browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) {}

var countriesInSouthernHemisphere = ["AF","AQ","AR","AS","AU","BI","BO","BR","BV","BW","CD","CG","CK","CL","EC","FJ","FK","GA","GS","ID","IO","KM","LS","MG","MU","MW","MZ","NA","NC","NR","NU","NZ","PE","PF","PG","PN","PY","RE","RW","SB","SC","SH","SZ","TF","TK","TL","TO","TV","TZ","UY","VU","WF","WS","YT","ZA","ZM","ZW"];
var timezonesInSouthernHemisphere = ["Asia/Kabul", "Antarctica/Rothera", "Antarctica/Palmer", "Antarctica/Mawson", "Antarctica/Davis", "Antarctica/Casey", "Antarctica/Vostok", "Antarctica/DumontDUrville", "Antarctica/Syowa", "Antarctica/Troll", "America/Argentina/Buenos_Aires", "America/Argentina/Cordoba", "America/Argentina/Salta", "America/Argentina/Jujuy", "America/Argentina/Tucuman", "America/Argentina/Catamarca", "America/Argentina/La_Rioja", "America/Argentina/San_Juan", "America/Argentina/Mendoza", "America/Argentina/San_Luis", "America/Argentina/Rio_Gallegos", "America/Argentina/Ushuaia", "Pacific/Pago_Pago", "Australia/Lord_Howe", "Antarctica/Macquarie", "Australia/Hobart", "Australia/Currie", "Australia/Melbourne", "Australia/Sydney", "Australia/Broken_Hill", "Australia/Brisbane", "Australia/Lindeman", "Australia/Adelaide", "Australia/Darwin", "Australia/Perth", "Australia/Eucla", "America/La_Paz", "America/Noronha", "America/Belem", "America/Fortaleza", "America/Recife", "America/Araguaina", "America/Maceio", "America/Bahia", "America/Sao_Paulo", "America/Campo_Grande", "America/Cuiaba", "America/Santarem", "America/Porto_Velho", "America/Boa_Vista", "America/Manaus", "America/Eirunepe", "America/Rio_Branco", "Africa/Abidjan", "Pacific/Rarotonga", "America/Santiago", "Pacific/Easter", "America/Guayaquil", "Pacific/Galapagos", "Pacific/Fiji", "Atlantic/Stanley", "Atlantic/South_Georgia", "Asia/Jakarta", "Asia/Pontianak", "Asia/Makassar", "Asia/Jayapura", "Indian/Chagos", "Africa/Nairobi", "Indian/Mauritius", "Africa/Maputo", "Africa/Windhoek", "Pacific/Noumea", "Africa/Lagos", "Pacific/Nauru", "Pacific/Niue", "Pacific/Auckland", "Pacific/Chatham", "America/Lima", "Pacific/Tahiti", "Pacific/Marquesas", "Pacific/Gambier", "Pacific/Port_Moresby", "Pacific/Bougainville", "Pacific/Pitcairn", "America/Asuncion", "Indian/Reunion", "Pacific/Guadalcanal", "Indian/Mahe", "Indian/Kerguelen", "Pacific/Fakaofo", "Asia/Dili", "Pacific/Tongatapu", "Pacific/Funafuti", "America/Montevideo", "Pacific/Efate", "Pacific/Wallis", "Pacific/Apia", "Africa/Johannesburg"];

var monthsShort = ["", "jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
var monthsLong =  ["", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];

var daysLong = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
var daysShort = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
var daysMini = ["mo", "tu", "we", "th", "fr", "sa", "su"];

var northernSeasons = ["winter", "spring", "summer", "fall"];
var southernSeasons = ["summer", "fall", "winter", "spring"];
var seasonsGeneralList = ["winter", "spring", "summer", "fall", "autumn"];

var timesOfDay = ["morning", "afternoon", "evening", "night", "noon", "midnight"];
var amPM24 = ["12a","1a","2a","3a","4a","5a","6a","7a","8a","9a","10a","11a","12p","1p","2p","3p","4p","5p","6p","7p","8p","9p","10p","11p"];

var numbersInWordsArray = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve"];
var numbersInWordsArrayAlt = ["no", "a", "di", "tri", "tetra", "penta", "hexa", "hepta", "octa", "nona", "decade", "undeca", "dozen"];

var oneDayInMilliseconds = 86400000;

////////////////////////////////////////////////////////
///////                                         ////////
///////      SYNTAX VERIFIERS & CONVERTERS      ////////
///////                                         ////////
////////////////////////////////////////////////////////

/**
 * Checks if a string is a "year" like "2020", returns null or the year as string
 * @param {*} string a string to check if it's a year
 */
function isItAYear(string) {
    string = string.toLowerCase();

    var currentYear = new Date().getFullYear();
    var yearString = parseInt(string);
    var isIt = null;
    if (typeof yearString === "number" && !isNaN(yearString)) {
        // 1826, because that's when photography was invented. boom. geeky fact right there. 
        for (var index = 1826; index <= currentYear; index++) {
            if (yearString === index) {
                isIt = yearString;
                break;
            }
        }
    }
    return isIt;
}


/**
 * Checks if a string is a season, returns null or an array of months
 * @param {*} string string to check for season
 */
function isItASeason(string) {
    string = string.toLowerCase();

    if (string === "autumn") { string = "fall"; }

    var country = detectedLocale;
    var seasons;
    var months = [];
    if (browserTimezone) {
        // got browser timezone = most reliable info. Use this.
        if (timezonesInSouthernHemisphere.indexOf(browserTimezone) > -1) {
            // user is in southern hemisphere
            north = false;
        } else {
            // user is in northern hemisphere
            north = true;
        }
    } else {
        if (country) {
            if (countriesInSouthernHemisphere.indexOf(country) > -1) {
                // user is in southern hemisphere
                north = false;
            } else {
                // user is in northern hemisphere
                north = true;
            }
        } else {
            north = true;
        }
    }

    if (north) {
        seasons = northernSeasons;
    } else {
        seasons = southernSeasons;
    }

    var seasonIndex = seasons.indexOf(string);
    if (seasonIndex === 0) {
        months = ["12", "01", "02"];
    } else if (seasonIndex === 1) {
        months = ["03", "04", "05"];
    } else if (seasonIndex === 2) {
        months = ["06", "07", "08"];
    } else if (seasonIndex === 3) {
        months = ["09", "10", "11"];
    } else {
        months = null;
    }
    return months;
}


/**
 * Takes a string like "summer 2019" and returns an array range of exif dates or null
 * @param {*} string string like "summer 2019"
 */
function isItASeasonOfYear(string) {
    var result, year, season;
    var elements = getSyntaxElements(string.toLowerCase());

    if (elements.length !== 2) {
        result = null;
    } else {
        elements.forEach(function (elem) {
            if (isItAYear(elem)) {
                year = isItAYear(elem);
            }

            if (isItASeason(elem)) {
                season = isItASeason(elem);
            }
        });

        if (year && season) {
            var startDate = year + ":" + season[0];
            var endDate = year + ":" + season[2];
            result = [startDate, endDate];
        } else {
            result = null;
        }
    }

    return result;
}
  


/**
 * This checks a string to see if it's a month, returns null, or the two-digit month as string.
 * @param {*} string string to check if it's a month
 */
function isItAMonth(string) {
    string = string.toLowerCase();

    var month;

    if (monthsShort.indexOf(string) > 0) {
        month = monthsShort.indexOf(string);
    }

    if (monthsLong.indexOf(string) > 0) {
        month = monthsLong.indexOf(string);
    }

    if (month) {
        if (month < 10) {
            month = "0" + month;
        } else {
            month = "" + month;
        }
    } else {
        month = null;
    }

    return month;
}



/**
 * Thsi checks if a string is a day, returns null, or the day as string.
 * @param {*} string string to check if it's a day
 */
function isItADay(string) {
    string = string.toLowerCase();

    var day;

    if (daysMini.indexOf(string) > -1) {
        day = daysMini.indexOf(string);
    } else if (daysShort.indexOf(string) > -1) {
        day = daysShort.indexOf(string);
    } else if (daysLong.indexOf(string) > -1) {
        day = daysLong.indexOf(string);
    } else {
        day = null;
    }

    if (day >= 0) {
        day = daysLong[day];
    }

    return day;
}
  



/**
 * This checks if a string has a time-of-day, and returns null or an array of time range [09:00, 16:00] etc.
 * @param {*} string string to check time of day
 */
function isItATimeOfDay(string) {
    string = string.toLowerCase();
    var startTime;
    var endTime;
    var result;

    if (string === "morning") {
        startTime = "05:00";
        endTime = "11:59";
    } else if (string === "afternoon") {
        startTime = "12:00";
        endTime = "17:59";
    } else if (string === "evening") {
        startTime = "18:00";
        endTime = "20:59";
    } else if (string === "night") {
        startTime = "21:00";
        endTime = "23:59";
    } else if (string === "noon") {
        startTime = "11:00";
        endTime = "13:00";
    } else if (string === "midnight") {
        startTime = "00:00";
        endTime = "04:59";
    } else {
        startTime = null;
        endTime = null;
    }

    if (startTime && endTime) {
        result = [startTime, endTime];
    } else {
        result = null;
    }
    return result;
}



/**
 * This checks if a string has time in it, takes a string, returns a 24H two-digit string like 22:30
 * @param {*} string checks if a string has time in it
 */
function isItATime(string) {
    var time = null;
    var hour;
    var min;
    string = string.toLowerCase();
    string = string.replace(".", ":").replace(",", ":").split(' ').join(':').split('-').join('');
    var elems = string.split(":");
    if (elems.length === 3) {
        if (["p", "pm", "a", "am"].indexOf(elems[2]) > -1 && (parseInt(elems[0]) < 24) && (parseInt(elems[1]) < 60)) {
            
            hour = parseInt(elems[0]);
            if (hour < 10) {
                hour = "0" + hour;
            }

            min = parseInt(elems[1]);
            if (min < 10) {
                min = "0" + min;
            }

            time = hour + ":" + min;

        }
    } else if (elems.length === 2) {
        if (["p", "pm", "a", "am"].indexOf(elems[1]) > -1 && (parseInt(elems[0]) >= 1) && (parseInt(elems[0]) <= 12)) {
            if (["p", "pm"].indexOf(elems[1]) > -1) {
                
                hour = parseInt(elems[0]) + 12;
                
                if (hour === 24) {
                    hour = "12";
                }

                time = hour + ":00";

            } else if (["a", "am"].indexOf(elems[1]) > -1) {
                
                hour = parseInt(elems[0]);
                
                if (hour === 12) {
                    hour = "00";
                }
                
                if (hour < 10) {
                    hour = "0" + hour;
                }
                
                time = hour + ":00";

            }
        } else if ((parseInt(elems[0]) < 24) && (parseInt(elems[1]) < 60)) {
            
            hour = parseInt(elems[0]);
            
            if (hour < 10) {
                hour = "0" + hour;
            }
            
            min = parseInt(elems[1]);
            
            if (min < 10) {
                min = "0" + min;
            }
            
            time = hour + ":" + min;
        }
    } else if (elems.length === 1) {
        var p = string.split("p");
        var a = string.split("a");

        if (p[0] >= 1 && p[0] <= 12 && (p[1] === "" || p[1] === "m")) {
            
            hour = parseInt(p[0]) + 12;
            
            if (hour === 24) {
                hour = "12";
            }
            
            time = hour + ":00";

        }

        if (a[0] <= 12 && (a[1] === "" || a[1] === "m")) {
            
            hour = parseInt(a[0]);
            
            if (hour === 12) {
                hour = "00";
            }
            
            if (hour < 10) {
                hour = "0" + hour;
            }
            
            time = hour + ":00";

        }
    }

    return time;
}
  


/**
 * This takes a string, checks if it's a date, if this has a day, use it exactly, if it has a year & month only then use it as a range, finally returns an EXIF compatible date string. 
 * @param {*} string string to check for a date
 */
function isItADate(string) {
    var elements = getSyntaxElements(string.toLowerCase());
    var strippedElements = [];
    var parsedDate, date;
    var parsedMonth, parsedYear;
    var isThereASeason = false;

    if (elements.length >= 2) {
        // strip ordinals like 2nd, 3rd etc.
        elements.forEach(function (elem) {
            var strippedElem;
            if (elem.match(/([0-9])(nd|th|st|rd)/g)) {
                strippedElem = elem.replace("nd", "").replace("th", "").replace("st", "").replace("rd", "");
            } else {
                strippedElem = elem;
            }
            strippedElements.push(strippedElem);

            if (isItASeason(elem)) {
                isThereASeason = true;
            }

            if (isItAYear(elem)) {
                parsedYear = isItAYear(elem);
            }

            if (parseInt(elem) > 0 && parseInt(elem) <= 12) {
                parsedMonth = parseInt(elem);
            }
        });

        var dateWithoutOrdinals = strippedElements.join(" ");
        parsedDate = new Date(Date.parse(dateWithoutOrdinals));
        if (parsedDate && Object.prototype.toString.call(parsedDate) === "[object Date]" && !isNaN(parsedDate)) {
            var today = new Date();
            var curMonth = today.getUTCMonth() + 1; // it's 0 based. fml
            var d = parsedDate.getUTCDate() + 1;
            var m = parsedDate.getUTCMonth() + 1; // 0-based jesus.
            var y;

            if (elements.length === 3) {
                y = parsedDate.getFullYear();
            } else {
                if (m <= curMonth) {
                    y = today.getFullYear(); // it's this year.
                } else {
                    y = today.getFullYear() - 1; // it's last year.
                }
            }

            if (!isThereASeason) {
                date = y + ":" + ("0" + m).slice(-2) + ":" + ("0" + d).slice(-2);
            } else {
                date = null;
            }

        } else {
            date = null;

            if (elements.length === 2 && parsedYear && parsedMonth) {
                date = parsedYear + ":" + ("0" + parsedMonth).slice(-2);
            }

        }
    }

    return date;
}


////////////////////////////////////////////////////////
///////                                         ////////
///////           CALCULATE HOW LONG AGO        ////////
///////                                         ////////
////////////////////////////////////////////////////////


function agoCalc(timeago, agoInDays) {
    var currentMoment = (new Date()).getTime();
    var tempStartDate = currentMoment - (timeago * agoInDays * oneDayInMilliseconds);
    var tempEndDate = currentMoment - (timeago * agoInDays * oneDayInMilliseconds) + (agoInDays * oneDayInMilliseconds);
    return [tempStartDate, tempEndDate];
}

function yearago(timeago) {
    var targetStartDate = new Date(new Date(new Date(agoCalc(timeago, 365)[0]).setDate(1)).setMonth(0)).toISOString().substr(0, 19).split("T")[0].split("-").join(":");
    var targetEndDate = new Date(new Date(new Date(agoCalc(timeago, 365)[1]).setDate(1)).setMonth(0)).toISOString().substr(0, 19).split("T")[0].split("-").join(":");
    return [targetStartDate, targetEndDate];
}

function monthago(timeago) {
    var targetStartDate = new Date(new Date(agoCalc(timeago, 30)[0]).setDate(1)).toISOString().substr(0, 19).split("T")[0].split("-").join(":");
    var targetEndDate = new Date(agoCalc(timeago, 30)[1]).toISOString().substr(0, 19).split("T")[0].split("-").join(":");
    return [targetStartDate, targetEndDate];
}

function weekago(timeago) {
    var targetStartDate = new Date(agoCalc(timeago, 7)[0]).toISOString().substr(0, 19).split("T")[0].split("-").join(":");
    var targetEndDate = new Date(agoCalc(timeago, 7)[1]).toISOString().substr(0, 19).split("T")[0].split("-").join(":");
    return [targetStartDate, targetEndDate];
}

function dayago(timeago) {
    var targetStartDate = new Date(agoCalc(timeago, 1)[0]).toISOString().substr(0, 19).split("T")[0].split("-").join(":");
    var targetEndDate = new Date(agoCalc(timeago, 1)[1]).toISOString().substr(0, 19).split("T")[0].split("-").join(":");
    return [targetStartDate, targetEndDate];
}





////////////////////////////////////////////////////////
///////                                         ////////
///////           SYNTAX CONJUNCTIONS           ////////
///////                                         ////////
////////////////////////////////////////////////////////

// TEST CASES :

// DATE
/////// June 13 2019
/////// June 13th 2019
/////// 13 June 2019
/////// 13th June 2019
/////// 06 2019
/////// 6th 2019

// YEAR 
/////// 2019 

// SEASON
/////// summer

// SEASON OF YEAR 
/////// summer 2019

// MONTH
/////// October
/////// November

// DAY
/////// Monday
/////// Tuesday

// TIME OF DAY
/////// morning
/////// evening

// TIME 
/////// 00:09
/////// 11.09
/////// 23:59



/**
 * Takes a string, and tries to figure out if it has any time-frame in it, if there is, returns "year", "season", "month", "day", "time of day", "time" or -null-
 * @param {*} string string of text to search for a time-frame
 * @returns {('year'|'season'|'month'|'day'|'time of day'|'time'|null)} timeframe
 */
function figureOutWhat(string) {
    string = string.trim();
    var what;
    if (isItADate(string)) {
        what = "date";
    } else if (isItAYear(string)) {
        what = "year";
    } else if (isItASeason(string)) {
        what = "season";
    } else if (isItASeasonOfYear(string)) {
        what = "seasonofyear";
    } else if (isItAMonth(string)) {
        what = "month";
    } else if (isItADay(string)) {
        what = "day";
    } else if (isItATimeOfDay(string)) {
        what = "timeofday";
    } else if (isItATime(string)) {
        what = "time";
    } else {
        what = null;
    }
    return what;
}



//  BEFORE, UNTIL, AFTER, SINCE
//  <=,     <=,    >=,    >=,    

// this doesn't include "ago", "back", "in" / "during" / "from".

// context.whatToSearch = ""; // date, month, year or day.

// context.startDate = "";
// context.startDay = "";
// context.startMonth = "";
// context.startYear = "";

// context.endDate = "";
// context.endDay = "";
// context.endMonth = "";
// context.endYear = "";

function figureOutConjunctions(elements) {
    var context = {};

    if (findOne(elements, ["before", "until"])) {
        context.operator = "<=";
        context.whatToSearch = ""; // date, month, year or day.
        context.endDate = "";
        context.endDay = "";
        context.endMonth = "";
        context.endYear = "";
    }

    if (findOne(elements, ["after", "since"])) {
        context.operator = ">=";
        context.whatToSearch = ""; // date, month, year or day.
        context.startDate = "";
        context.startDay = "";
        context.startMonth = "";
        context.startYear = "";
    }

    return context;
}


function beforeWhen(elements) {
    var indexOfBefore = (elements.indexOf("before") || elements.indexOf("until"));
    var prev, next, startTime, endTime;

    // [y] = startTime
    // {X} = endTime

    var prevIndexA = indexOfBefore - 1; // [year] BEFORE X, [week] BEFORE X, [month] BEFORE X  
    var prevIndexB = indexOfBefore - 2; // [2 years] BEFORE X, [2 hours] BEFORE X, 
    if (elements[prevIndexB]) {
        prev = figureOutWhat(elements[prevIndexB] + " " + elements[prevIndexA]);
    } else {
        prev = figureOutWhat(elements[prevIndexA]);
    }

    var nextIndexA = indexOfBefore + 1; // BEFORE {yesterday}, BEFORE {evening}, BEFORE {2pm}, BEFORE {2019}, BEFORE {january} etc.
    var nextIndexB = indexOfBefore + 2; // BEFORE {last year}, BEFORE {january 2019}, BEFORE {2 oclock}.
    var nextIndexC = indexOfBefore + 3; // BEFORE {january 2nd 2019}.

    if (elements[nextIndexA] && elements[nextIndexB] && elements[nextIndexC]) {
        next = figureOutWhat(elements[nextIndexA] + " " + elements[nextIndexB] + " " + elements[nextIndexC]);
    } else if (elements[nextIndexA] && elements[nextIndexB]) {
        next = figureOutWhat(elements[nextIndexA] + " " + elements[nextIndexB]);
    } else if (elements[nextIndexA]) {
        next = figureOutWhat(elements[nextIndexA]);
    } else {
        next = null;
    }

    if (prev) {
        // startTime = prev
    }

    if (next) {
        // endTime = next
    } else {
        // endtime = {today}
    }

    return context;
}

function convertSyntaxElementsToMonth(elements) {
    var month;
    elements.forEach(function (element) {
        var tempMonth = isItAMonth(element);
        if (tempMonth) {
            month = tempMonth;
        }
    });
    return month;
}

function convertTimeOfDayToTime(elements) {
    var range, timeOfDay;
    elements.forEach(function (element) {
        var tempTimeOfDay = isItATimeOfDay(element);
        if (tempTimeOfDay) {
            range = tempTimeOfDay;
            timeOfDay = element;
        }
    });
    return [range, timeOfDay];
}

function convertSeasonToMonths(season) {
    return isItASeason(season);
}










////////////////////////////////////////////////////////
///////                                         ////////
///////          GRAMMATICAL SEARCH             ////////
///////                                         ////////
////////////////////////////////////////////////////////




function getSyntaxElements(searchTerm) {
    var elements = searchTerm.split(" ").join(",")
        .split(".").join(",")
        .split("/").join(",")
        .split(":").join(",")
        .split("-").join(",")
        .split("–").join(",")
        .split("+").join(",")
        .split("&").join(",")
        .split("(").join(",")
        .split(")").join(",")
        .split(")").join(",")
        .split(",");

    return elements;
}

function figureOutWhen(elements) {
    var timeago;
    for (var i = 0; i < elements.length; i++) {
        elem = elements[i];
        timeago = parseInt(elem);
        if (timeago) {
            break;
        }
    }

    if (!timeago) {
        for (var j = 0; j < elements.length; j++) {
            elem = elements[j];
            var elemIndex = numbersInWordsArray.indexOf(elem);
            if (elemIndex >= 0) {
                timeago = elemIndex;
            }

            var elemAltIndex = numbersInWordsArrayAlt.indexOf(elem);
            if (elemAltIndex >= 0) {
                timeago = elemAltIndex;
            }

            if (timeago) {
                break;
            }
        }
    }

    return timeago;
}


// Formerly, in V2, references used this format  
// reference.where('year', '==', yearsAgo);
// 
// and to combine them, we chained them like :
// reference = reference.where('year', '==', yearsAgo);
// reference = reference.where('month', 'in', seasonMonths);
// etc. 
// 
// instead, now we'll build references like an array, with objects
// i.e. 
//
// reference = [
//     {'left' : year, "operator" : "=", "right" : yearsAgo},
//     {'left' : month, "operator" : "in", "right" : seasonMonths}
// ];
//
// and instead, we'll keep adding in objects to references to chain them.
// here's a shortcut function to make transition easier. 

function referenceWhere(reference, left, operator, right) {
    reference = reference || [];
    reference.push({ "left": left, "operator": operator, "right": right });
    return reference;
}


/**
 * Takes a search string and returns what it understands & references
 * @param {string} searchTerm a search string
 * @returns {Object} syntacticReferences
 * @returns {Object} syntacticReferences.r references
 * @returns {Object} syntacticReferences.u understhood
 */
async function getSyntacticReferences(searchTerm) {
    var targetStartDate, targetEndDate;
    var comboMonth, comboYear, comboSeason, comboTimesOfDay;
    var reference = [];
    var thisYear = new Date().getFullYear();
    var understood = "";

    if (typeof searchTerm !== "string") { return null; }
    searchTerm = searchTerm.toLowerCase();

    var elements = getSyntaxElements(searchTerm);
    var timeago = figureOutWhen(elements);

    if (findOne(elements, ["ago", "back"]) && typeof timeago === "number" && !isNaN(timeago)) {
        // we'll use the current date to compute this - whatever the ago value is. 

        if (findOne(elements, ["day", "days"])) {
            targetStartDate = dayago(timeago)[0];
            targetEndDate = dayago(timeago)[1];
        }

        if (findOne(elements, ["week", "weeks"])) {
            targetStartDate = weekago(timeago)[0];
            targetEndDate = weekago(timeago)[1];
        }

        if (findOne(elements, ["month", "months"])) {
            targetStartDate = monthago(timeago)[0];
            targetEndDate = monthago(timeago)[1];
        }

        if (findOne(elements, ["year", "years"])) {
            var yearsAgo = (thisYear - timeago) + "";
            reference = referenceWhere(reference, 'year', '==', yearsAgo);
            understood = understood + " <b>" + yearsAgo + "</b>";
        }

        if (targetStartDate && targetEndDate) {
            reference = referenceWhere(reference, 'date', '>=', targetStartDate);
            reference = referenceWhere(reference, 'date', '<=', targetEndDate);
            understood = targetStartDate + " – " + targetEndDate;
        }

        comboMonth = combineWithMonth(elements, reference, understood);
        if (comboMonth) {
            reference = comboMonth.r;
            understood = comboMonth.u;
        }

        if (reference === []) { return null; }

        return { r : reference, u : understood };

    } else if (findOne(elements, ["last", "previous"])) {

        if (elements.indexOf("week") > -1) {
            targetStartDate = weekago(1)[0];
            targetEndDate = weekago(1)[1];
        }

        if (elements.indexOf("month") > -1) {
            targetStartDate = monthago(1)[0];
            targetEndDate = monthago(1)[1];
        }

        if (targetStartDate && targetEndDate) {
            reference = referenceWhere(reference, 'date', '>=', targetStartDate);
            reference = referenceWhere(reference, 'date', '<=', targetEndDate);
            understood = targetStartDate + " – " + targetEndDate;
        }

        if (reference === [] || elements.indexOf("year") > -1) {
            var lastYear = (thisYear - 1) + "";
            reference = referenceWhere(reference, 'year', '==', lastYear);
            understood = understood + " <b>" + lastYear + "</b>";
        }

        comboMonth = combineWithMonth(elements, reference, understood);
        if (comboMonth) {
            reference = comboMonth.r;
            understood = comboMonth.u;
        }

        if (reference === []) { return null; }

        return { r : reference, u : understood };

    } else {

        comboMonth = combineWithMonth(elements, reference, understood);
        if (comboMonth) {
            reference = comboMonth.r;
            understood = comboMonth.u;
        }

        comboYear = combineWithYear(elements, reference, understood);
        if (comboYear) {
            reference = comboYear.r;
            understood = comboYear.u;
        }

        comboSeason = combineWithSeason(elements, reference, understood);
        if (comboSeason) {
            reference = comboSeason.r;
            understood = comboSeason.u;
        }

        comboTimesOfDay = combineWithTimesOfDay(elements, reference, understood);
        if (comboTimesOfDay) {
            reference = comboTimesOfDay.r;
            understood = comboTimesOfDay.u;
        }

        if (reference === []) { return null; }

        return { r : reference, u : understood };

    }
   
}







function combineWithMonth(elements, reference, understood) {
    if (findOne(elements, monthsShort) || findOne(elements, monthsLong)) {
        var month = convertSyntaxElementsToMonth(elements);
        if (month) {
            reference = referenceWhere(reference, 'month', '==', month);
            understood = understood + " " + monthsLong[parseInt(month)] + "";
        }
    }

    return { r: reference, u: understood };
}

function combineWithYear(elements, reference, understood) {
    var year = null;

    elements.forEach(function (elem) {
        if (isItAYear(elem)) {
            year = elem;
        }
    });

    if (year) {
        reference = referenceWhere(reference, 'year', '==', year);
        understood = understood + " <b>" + year + "</b>";
    }

    return { r: reference, u: understood };
}

function combineWithSeason(elements, reference, understood) {
    var seasonMonths = null;
    var understoodSeason = "";

    elements.forEach(function (elem) {
        if (findOne([elem], seasonsGeneralList)) {
            seasonMonths = convertSeasonToMonths(elem); // returns an array of months for the season.        
            if (seasonMonths) {
                understoodSeason = elem;
            }
        }
    });

    if (seasonMonths) {
        reference = referenceWhere(reference, 'month', 'in', seasonMonths);
        understood = understood + " " + understoodSeason + "";
    }

    return { r: reference, u: understood };
}

function combineWithTimesOfDay(elements, reference, understood) {
    if (findOne(elements, timesOfDay)) {
        var timeResults = convertTimeOfDayToTime(elements);
        var timeRange = timeResults[0]; // [start, end] range
        var timeOfDay = timeResults[1];

        if (timeRange[0] !== "not-a-time") {
            reference = referenceWhere(reference, 'time', '>=', timeRange[0]);
            reference = referenceWhere(reference, 'time', '<=', timeRange[1]);
            understood = understood + " <b>" + timeOfDay + "</b> (" + timeRange.join(" – ") + ")";
        }

        return { r: reference, u: understood };
    }
}
  



async function searchDatesSyntactically(searchTerm, searchID) {

    // for now we're passing in a blank array as original reference, 
    // although theoretically, we can combine multiple search terms if we'd like to by passing in the resulting ref to this yet again.

    var syntacticReferences = await getSyntacticReferences(searchTerm);
    if (!syntacticReferences) { return { results : [], understood: "" }; }

    var references = syntacticReferences.r;
    var understood = syntacticReferences.u;

    if (references.length === 0) {
        breadcrumb("[SEARCH] Couldn't get any references to search");
        return { results : [], understood: "" };
    }

    breadcrumb("[SEARCH] Running syntactic search");

    var syntacticSearchResults = await getSyntacticSearchResults(references);
        
    breadcrumb("[SEARCH] Syntactic search complete!");

    return { results : (syntacticSearchResults || []), understood: understood, searchID : searchID, type:"date" };

}





// gotSyntacticSearchResults is in photos/apis.js (since that's where it will be used)




function search(term, searchID) {
    
    activityHappened();
    
    $("#searchContents").empty();
    
    // WE'LL PARALLEL PATH HERE
    // 1) We'll search for titles, using fusejs and display them
    // 2) We'll search for date/time references syntactically using the code in photos-search.js, and display them. 
    
    // we'll only allow functions with the correct searchID to return the results to prevent a foot race.

    // syntactic search will return a {results : [results], understood : "understood", searchID : "12345", type:"date" } and we can use these to build / reflect search results.
    // titles search will return a { results : [results], understood : "term", searchID : "12345", type:"name" } and we can use these to build / reflect search results.

    Promise.all([
        searchTitles(term, searchID).then(displaySearchResults),
        searchTags(term, searchID).then(displaySearchResults),
        searchDatesSyntactically(term, searchID).then(displaySearchResults)
    ]).then(()=>{
        stopMainProgressforSearch();
    });

}

async function searchTitles(term, searchID) {
    
    // let's clear the array first
    searchArray = [];
    
    // now let's add all albums from memory to this 
    for (var aid in albums) {
        searchArray.push({ id : aid, name : albums[aid].decryptedTitle });
    }

    var fuse = new Fuse(searchArray, searchOptions);
    var results = fuse.search(term);
    
    return { results : results, understood : term, searchID : searchID, type:"name" };

} 

async function searchTags(term, searchID) {
    
    var typedTags = extractHashtags(term);
    
    if (!typedTags.length) { return { results : [], understood: "" }; }
    
    var tags = {};
    var hmacs = [];
    var understood = typedTags.join(" or ");

    try {
        for (const hashtag of typedTags) {

            var plaintextTag = hashtag.replace("#", "") || "";
    
            // this is to de-duplicate tags, in case if the user typed it twice. skip to save encryption & hmac processing time.
            if (tags[plaintextTag]) { continue; }
    
            var hmacOfTag = await hmacString(plaintextTag, theKey);
            
            hmacs.push(hmacOfTag);

        }
    } catch (error) {
        handleError("[SEARCH PHOTOS] Failed to hmac a tag", error);
    }
    
    if (!hmacs.length) { return { results : [], understood: "" }; }


    breadcrumb("[SEARCH] Running tags search");

    var tagsSearchResults = await getTagsSearchResults(hmacs);
        
    breadcrumb("[SEARCH] Tags search complete!");

    return { results : (tagsSearchResults || []), understood: understood, searchID : searchID, type:"tags" };

}

async function displaySearchResults(sr) {
    var wrap = $(`#searchContents[search="${sr.searchID}"]`);

    var resultsHTML = [];

    if (sr.type === "tags") {

        if (sr.results.length > 0) {
            resultsHTML.push(renderSearchHeader(`PHOTOS TAGGED WITH: ${sr.understood}`));
        }

        var resultAlbums = {};
        sr.results.forEach(result => {
            var aid = photos[result.id].aid;
            resultAlbums[aid] = (resultAlbums[aid] || 0) + 1;
        });

        Object.keys(resultAlbums).forEach(aid => {
            resultsHTML.push(renderAlbum(aid, resultAlbums[aid] + " PHOTOS"));
        });

    }

    if (sr.type === "name") {

        if (sr.results.length > 0) {
            resultsHTML.push(renderSearchHeader(`ALBUMS MATCHING "${sr.understood}"`));
        }

        sr.results.forEach(result => {
            if (result.item.id.startsWith("f-")) {
                resultsHTML.push(renderAlbum(result.item.id));
            }
        });
        
    }

    if (sr.type === "date") {

        if (sr.results.length > 0) {
            resultsHTML.push(renderSearchHeader(`PHOTOS FROM ${sr.understood}`));
        }

        var resultAlbums = {};
        sr.results.forEach(result => {
            var aid = photos[result.id].aid;
            resultAlbums[aid] = (resultAlbums[aid] || 0) + 1;
        });

        Object.keys(resultAlbums).forEach(aid => {
            resultsHTML.push(renderAlbum(aid, resultAlbums[aid] + " PHOTOS"));
        });
        
    }

    // FOR NOW PHOTOS AREN'T DISPLAYED, BECAUSE WE'RE NOT GETTING THE NAMES OF PHOTOS, 
    // WHICH MEANS WE CAN'T LOAD THE PHOTOS WITHOUT KNOWING THEIR EXTENSIONS

    // add everything to search results
    wrap.append(resultsHTML.join(""));

    // show everything
    wrap.removeClass("loading");

    setTimeout(function () {
        // scroll to top

        if ($(window).width() <= 703) {
            scrollVerticalTo(64);
        } else {
            scrollTop(0);
        }

        $("#searchContents").children().each(function () {
            // don't worry, we only add the intersection observer once to the same element
            setupIntersectionObserver (this);
        });
    }, 500);
}











/**
 * Clears search results, and optionally doesn't scroll
 * @param {*} dontScroll 
 */
function clearSearch(dontScroll) {
    dontScroll = dontScroll || false;

    $("#searchContents").empty();
    $("#searchContents").attr("search", "");
    $("#searchContents").attr("term", "");
    $("#searchInput").val("");
    $("#searchInput").trigger("blur");
    
    if (!dontScroll) { scrollTop(); }
}