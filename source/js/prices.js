var storagePlans = {
    mo : {
        "10GB"  : 523200,
        "400GB" : 523202,
        "2000GB": 560659,
    }, 
    yr : {
        "10GB"  : 560664,
        "400GB" : 560661,
        "2000GB": 560663
    }
};

// same for paddle & stripe
var storagePlansByID = {
    523200 : { "period" : "mo", "quota" : 10000000000,   "formattedQuota" : "10 GB"   },
    560664 : { "period" : "yr", "quota" : 10000000000,   "formattedQuota" : "10 GB"   },
    523202 : { "period" : "mo", "quota" : 400000000000,  "formattedQuota" : "400 GB"  },
    560661 : { "period" : "yr", "quota" : 400000000000,  "formattedQuota" : "400 GB"  },
    560659 : { "period" : "mo", "quota" : 2000000000000, "formattedQuota" : "2000 GB" },
    560663 : { "period" : "yr", "quota" : 2000000000000, "formattedQuota" : "2000 GB" }
};