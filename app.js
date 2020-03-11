const polyline = require("@mapbox/polyline");
const fetch = require("node-fetch");
const express = require("express");
const app = express();

const hostname = "127.0.0.1";
const port = process.env.PORT || 3000;
const otpHostCurrent = 'http://40.76.46.216:2000';
const otpHostPrototype = 'http://40.76.46.216:8000';

let legInfo = [];

//Body Parser middleware
app.use(express.json());

//test get request to see whats going on
app.get('/', (req, res) => {
    res.send("Hello");
});

//Post request that will handle returning the json of route info
app.post('/', (req, res) => {
    console.log(req.body);
    let url = urlCreator(req.body)
    console.log(url);
    fetch(url).then( async (response) => {
       let body = await response.json();
    res.send(jsonParsing(body.plan, body.plan.itineraries[0].legs));
   })
});

//Function to create the URL to make the call to the OTP API
function urlCreator(reqBody) {
    fromPlace = reqBody.fromPlace;
    toPlace = reqBody.toPlace;
    startTime = reqBody.startTime;
    startDate = reqBody.startDate;
    arriveBy = reqBody.arriveBy;
    return url = otpHostCurrent + '/otp/routers/default/plan?fromPlace=' + fromPlace + '&toPlace=' + toPlace + '&time=' + startTime + '&date=' + startDate + '&mode=TRANSIT,WALK&maxWalkDistance=500&arriveBy=' + arriveBy;
}

//Function that will parse the api call and return the important stuff
function jsonParsing(jsonData, jsonLegData) {
    completePolyline = [];
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
