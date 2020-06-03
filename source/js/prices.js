var priceTable = {
    "a" : { "m" : 3 , "y" : 3 , "yt": 36 },
    "b" : { "m" : 11, "y" : 9 , "yt": 108},
    "c" : { "m" : 30, "y" : 27, "yt": 324}
};

var plansObject = {
    523200 : { "p" : "m", "period" : "mo", "quota" : 10000000000, "formattedQuota" : "10 GB" },
    523300 : { "p" : "y", "period" : "yr", "quota" : 10000000000, "formattedQuota" : "10 GB" }, // old 10gb/yr
    560664 : { "p" : "y", "period" : "yr", "quota" : 10000000000, "formattedQuota" : "10 GB" }, // new 10gb/yr
  
    523201 : { "p" : "m", "period" : "mo", "quota" : 20000000000, "formattedQuota" : "20 GB" }, // old 20gb/mo
    523301 : { "p" : "y", "period" : "yr", "quota" : 20000000000, "formattedQuota" : "20 GB" }, // old 20gb/yr
    
    523202 : { "p" : "m", "period" : "mo", "quota" : 400000000000, "formattedQuota" : "400 GB" },
    560661 : { "p" : "y", "period" : "yr", "quota" : 400000000000, "formattedQuota" : "400 GB" },
  
    560659 : { "p" : "m", "period" : "mo", "quota" : 2000000000000, "formattedQuota" : "2000 GB" },
    560663 : { "p" : "y", "period" : "yr", "quota" : 2000000000000, "formattedQuota" : "2000 GB" }
};
  
function switchPeriod (period) {
    period = period || "m";

    $(".period-button").removeClass("selected");
    $(".period-button[period='"+period+"']").addClass("selected");

    $(".prorate-plans").removeClass("selected");
    $(".prorate-plans[period='"+period+"']").addClass("selected");
    
    $(".per-period-button").removeClass("selected");
    $(".per-period-button[period='"+period+"']").addClass("selected");

    displayPrices(period);
    try { selectedPaymentPeriod = period; } catch (e) {}
}

function displayPrices (period) {
    period = period || "m";

    if (period === "m") {
        // show prices for mo-to-mo
        $(".cost[tier='a']").find(".price").html(priceTable.a.m);
        $(".cost[tier='b']").find(".price").html(priceTable.b.m);
        $(".cost[tier='c']").find(".price").html(priceTable.c.m);

        $(".price-wrap[tier='a']").find(".price").html(priceTable.a.m);
        $(".price-wrap[tier='b']").find(".price").html(priceTable.b.m);
        $(".price-wrap[tier='c']").find(".price").html(priceTable.c.m);

        $(".pricing-card").find(".this-period").html("billed monthly");
        $(".pricing-card").find(".other-period").html("billed yearly");
        $(".mobile-pricecard").find(".this-period").html("billed monthly");
        $(".mobile-pricecard").find(".other-period").html("billed yearly");
        
        $(".pricing-card[plan='a']").find(".other-period-price").html(priceTable.a.y);
        $(".pricing-card[plan='b']").find(".other-period-price").html(priceTable.b.y);
        $(".pricing-card[plan='c']").find(".other-period-price").html(priceTable.c.y);

        $(".mobile-pricecard[plan='a']").find(".other-period-price").html(priceTable.a.y);
        $(".mobile-pricecard[plan='b']").find(".other-period-price").html(priceTable.b.y);
        $(".mobile-pricecard[plan='c']").find(".other-period-price").html(priceTable.c.y);
    } else {
        // show prices for yearly
        $(".cost[tier='a']").find(".price").html(priceTable.a.y);
        $(".cost[tier='b']").find(".price").html(priceTable.b.y);
        $(".cost[tier='c']").find(".price").html(priceTable.c.y);

        $(".price-wrap[tier='a']").find(".price").html(priceTable.a.y);
        $(".price-wrap[tier='b']").find(".price").html(priceTable.b.y);
        $(".price-wrap[tier='c']").find(".price").html(priceTable.c.y);

        $(".pricing-card").find(".this-period").html("billed yearly");
        $(".pricing-card").find(".other-period").html("billed monthly");
        $(".mobile-pricecard").find(".this-period").html("billed yearly");
        $(".mobile-pricecard").find(".other-period").html("billed monthly");
        
        $(".pricing-card[plan='a']").find(".other-period-price").html(priceTable.a.m);
        $(".pricing-card[plan='b']").find(".other-period-price").html(priceTable.b.m);
        $(".pricing-card[plan='c']").find(".other-period-price").html(priceTable.c.m);

        $(".mobile-pricecard[plan='a']").find(".other-period-price").html(priceTable.a.m);
        $(".mobile-pricecard[plan='b']").find(".other-period-price").html(priceTable.b.m);
        $(".mobile-pricecard[plan='c']").find(".other-period-price").html(priceTable.c.m);
    }
}

function prorateLogic (curPlan, newPlan) {
    var willProrate = false;
    var billImmediately = true;
    var disallowed = false;

    if (curPlan && newPlan) {

        // ---------------------------------------------------------------------------------------- //
        // ----------------------------------------- UPGRADES ------------------------------------- //
        // ---------------------------------------------------------------------------------------- //

        if ((plansObject[newPlan].quota > plansObject[curPlan].quota)) {

            // UPGRADE (mo -> mo) = prorate, bill immediately
            // UPGRADE (mo -> yr) = prorate, bill immediately
            if (plansObject[curPlan].period === "mo") {
                willProrate = true;
                billImmediately = true;
            }
            
            // UPGRADE (yr -> yr) = prorate, bill immediately
            if (plansObject[curPlan].period === "yr" && plansObject[newPlan].period === "yr") {
                willProrate = true;
                billImmediately = true;
            }
            
            // UPGRADE (YR -> MO) = DISALLOWED
            if (plansObject[curPlan].period === "yr" && plansObject[newPlan].period === "mo") {
                disallowed = true;
            }
        }
    
        // ---------------------------------------------------------------------------------------- //
        // ---------------------------------------- DOWNGRADES ------------------------------------ //
        // ---------------------------------------------------------------------------------------- //
    
        if ((plansObject[newPlan].quota < plansObject[curPlan].quota)) {
    
            // DOWNGRADE (mo -> mo) == don't prorate, don't bill immediately
            if (plansObject[curPlan].period === "mo" && plansObject[newPlan].period === "mo") {
                willProrate = false;
                billImmediately = false;
            }
            
            // DOWNGRADE (yr -> yr) == don't prorate, don't bill immediately
            if (plansObject[curPlan].period === "yr" && plansObject[newPlan].period === "yr") {
                willProrate = false;
                billImmediately = false;
            }
    
            // DOWNGRADE (mo -> yr) == don't prorate, don't bill immediately
            if (plansObject[curPlan].period === "mo" && plansObject[newPlan].period === "yr") {
                willProrate = true;
                billImmediately = true;
            }
    
            // DOWNGRADE (yr -> mo) = disallowed
            if (plansObject[curPlan].period === "yr" && plansObject[newPlan].period === "mo") { 
                disallowed = true; 
            }
    
        }
    
        // ---------------------------------------------------------------------------------------- //
        // -------------------------------------- PERIOD CHANGES ---------------------------------- //
        // ---------------------------------------------------------------------------------------- //
    
        // same quota // period change. 
        if ((plansObject[newPlan].quota === plansObject[curPlan].quota)) { 
    
            // (yr -> mo) = disallowed
            if (plansObject[curPlan].period === "yr") { 
                disallowed = true; 
            }
    
            // (mo -> yr) == prorate, bill immediately.
            if (plansObject[curPlan].period === "mo" && plansObject[newPlan].period === "yr") {
                willProrate = true;
                billImmediately = true;
            }
    
        }
    
        return {billImmediately : billImmediately, willProrate : willProrate, disallowed : disallowed };
        
    } else {
        return "error";
    }
    
}