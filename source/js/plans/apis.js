////////////////////////////////////////////////
////////////////////////////////////////////////
//	ALL PAYMENTS / CHECKOUT APIS
////////////////////////////////////////////////
////////////////////////////////////////////////

async function checkVAT(vatNumber) {

    vatNumber = (vatNumber || "").trim();

    if (!vatNumber) { return false; }

    var response;
    try {
        response = await axios.get(apiROOT + "/api/vat?v=" + vatNumber);
    } catch (e) {}

    if (!response || isEmpty(response)) { return false; }

    return response.data;

}


/**
 * Checkout info for all Stripe details
 * @param {String} paymentMethodID Stripe Payment Method ID
 * @param {*} billingDetails Billing info
 * @param {*} storagePlanID
 * @param {String} [vatNumber]
 */
async function checkout(paymentMethodID, billingDetails, storagePlanID, vatNumber) {
    breadcrumb('[UPGRADE] Starting Checkout');

    vatNumber = vatNumber || "";

    if (!storagePlanID)          { handleError("[CHECKOUT] Can't checkout without storagePlanID");   return false; }
    if (!paymentMethodID)        { handleError("[CHECKOUT] Can't checkout without paymentMethodID"); return false; }
    if (isEmpty(billingDetails)) { handleError("[CHECKOUT] Can't checkout without billingDetails");  return false; }

    var checkoutDetails = {
        paymentMethodID : paymentMethodID, 
        billingDetails  : billingDetails,
        storagePlanID   : storagePlanID,
        vatNumber       : vatNumber,
    };

    var apiResponse; 

    try {
        apiResponse = await api("payments-checkout", {}, checkoutDetails, "POST");
    } catch (error) {
        handleError("[CHECKOUT] API had an error.", error);
        return false;
    }

    if (!apiResponse || isEmpty(apiResponse)) {
        handleError("[CHECKOUT] Didn't get a response from the API.");
        return false;
    }

    if (apiResponse.status !== 200) {
        handleError("[CHECKOUT] API had an error: " + apiResponse.status);
        return false;
    }

    // 3DS Auth
    if (apiResponse.data.startsWith("pi_") && apiResponse.data.includes("_secret_")) {
        return apiResponse.data;
    }

    return true;

}


/**
 * Switches user from one plan to another. 
 * @param {string} planID 
 */
async function switchPlans(planID) {
    breadcrumb('[CHANGE PLANS] Changing to ' + planID);

    var apiResponse; 

    try {
        apiResponse = await api("payments-switchplans", { p : planID }, {}, "POST");
    } catch (error) {
        handleError("[CHANGE PLANS] API had an error.", error);
        return false;
    }

    if (!apiResponse || isEmpty(apiResponse)) {
        handleError("[CHANGE PLANS] Didn't get a response from the API.");
        return false;
    }

    if (apiResponse.status !== 200) {
        handleError("[CHANGE PLANS] API had an error: " + apiResponse.status);
        return false;
    }

    breadcrumb('[CHANGE PLANS] Changed user plan to ' + planID);
    

    return true;
}