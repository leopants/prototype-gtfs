const polyline = require("@mapbox/polyline");
const fetch = require("node-fetch");
const express = require("express");
const app = express();
const Nominatim = require('nominatim-geocoder');
const geocoder = new Nominatim;

const hostname = "127.0.0.1";
const port = process.env.PORT || 3000;

//2000 prototype(dummy gtfs)
//8000 currently in use by google and mdc transit
const otpHostPrototype = 'http://40.76.46.216:2000';
const otpHostCurrent = 'http://40.76.46.216:8000';

//Body Parser middleware
app.use(express.json());

//test get request to see whats going on
app.get('/', (req, res) => {
    res.send("Hello");
});

//Post request that will handle returning the json of route info
app.post('/', async (req, res) => {
    console.log(req.body);
    urlCurrent = '';
    urlPrototype = '';
    try {
        urlCurrent = await urlCreator(otpHostCurrent, req.body);
        urlPrototype = await urlCreator(otpHostPrototype, req.body);
    }
    catch(err) {
        res.status(500).json({ error: err.toString() });
    }
    console.log(urlCurrent);

    try {
        oldResponse = await fetch(urlCurrent).then(async response => {
            let body = await response.json();
            return jsonParsing(body.plan, body.plan.itineraries[0].legs)});
    }
    catch(err) {
        oldResponse = {msg:"No transit times available. The date may be past or too far in the future or there may not be transit service for your trip at the time you chose."};
    }

    try {
        prototypeResponse = await fetch(urlPrototype).then(async response => {
            let body = await response.json();
            return jsonParsing(body.plan, body.plan.itineraries[0].legs)});
    }
    catch(err) {
        prototypeResponse = {msg:"No transit times available. The date may be past or too far in the future or there may not be transit service for your trip at the time you chose."};
    }
    res.send({oldResponse, prototypeResponse});
});

//Function to create the URL to make the call to the OTP API
async function urlCreator(otpHost, reqBody) {
    try {
        fromPlace = await geocoder.search({q:reqBody.fromPlace});
        fromPlace = [fromPlace[0].lat, fromPlace[0].lon];
        fromPlace = fromPlace[0] + ',' + fromPlace[1];
        console.log(fromPlace);
    }
    catch(err) {
        throw new Error('Your origin could not be found');
    }

    try {
        toPlace =  await geocoder.search({q:reqBody.toPlace});
        toPlace = [toPlace[0].lat, toPlace[0].lon];
        toPlace = toPlace[0] + ',' + toPlace[1];
        console.log(toPlace);
    }
    catch(err) {
        throw new Error('Your destination could not be found');
    }
    
    startTime = reqBody.startTime;
    startDate = reqBody.startDate;
    arriveBy = reqBody.arriveBy;
    maxWalkDistance = (reqBody.maxWalkDistance) * 1609; //received in miles must be in meters
    optimize = reqBody.optimize;
    return url = otpHost + '/otp/routers/default/plan?fromPlace=' + fromPlace + '&toPlace=' 
                + toPlace + '&time=' + startTime + '&date=' + startDate + '&mode=TRANSIT,WALK&maxWalkDistance='
                + maxWalkDistance +'&arriveBy=' + arriveBy + '&optimize=' + optimize;
}

//Function that will parse the api call and return the important stuff
function jsonParsing(jsonData, jsonLegData) {
    completePolyline = [];
    legInfo = [];
    time = {
        walkingTime : jsonData.itineraries[0].walkTime,
        transitTime : jsonData.itineraries[0].transitTime,
        waitingTime : jsonData.itineraries[0].waitingTime,
        start : jsonData.itineraries[0].startTime,
        end : jsonData.itineraries[0].endTime,
        transfers : jsonData.itineraries[0].transfers,
        transitModes : getTransitModes(jsonLegData)
    };
    for (j=0; j < jsonLegData.length; j++) {
        legInfo.push({ currentLeg:j + 1,
            transitMode:jsonLegData[j].mode, 
            legDuration : (jsonLegData[j].endTime - jsonLegData[j].startTime) / 1000,
            route : jsonLegData[j].route,
            routeName: jsonLegData[j].routeLongName,
            routeID : jsonLegData[j].routeId,
            routeColor : jsonLegData[j].routeColor,
            departurePlace : jsonLegData[j].from.name,
            departureTime : jsonLegData[j].from.departure,
            arrivalPlace : jsonLegData[j].to.name,
            arrivalTime : jsonLegData[j].to.arrival,
            legPolyline : decodeGeometry(jsonLegData[j].legGeometry.points)});
        completePolyline.push(decodeGeometry(jsonLegData[j].legGeometry.points));
    }
    return {time, completePolyline, legInfo};
}

function getTransitModes(legs) {
    transitModes = [];
    for (i = 0; i < legs.length; i++) {
        transitModes.push(legs[i].mode);
    }
    return transitModes;
}

function decodeGeometry(encoded) {
    //returns an array of long and lat each element corresponding to a point
    let decoded = polyline.decode(encoded);
    return decoded;
}

app.listen(port, () => console.log(`App listening on port ${port}!`))