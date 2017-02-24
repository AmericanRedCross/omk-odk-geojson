//file: osm-osmtogeojson.js
//coder: Max Grossman
//purpose: grab .osm files attached to omk submissions and spatialize submissions

var settings = require('./settings.js');
// node modules //
var request = require('request');
var oag = require('osm-and-geojson');
var extend = require('extend')
var DOMParser = require('xmldom').DOMParser
var geojsonMerge = require('geojson-merge')

// GET submissions json for projectName with omk api //

//name of project to get submissions json for
var projectName = 'colombia_buildings';
//JSON returned from call to omkserver endpoint in fetchSurvey
var projectJSON = '';
//osm XML string from call to omkserver endpoint in fetchSurveyOSM
var subOSM = ''
//geojson made from subOSM, using osm-and-geojson
var subGeoJSON = ''
//list of obj where key = instanceId, val = subGeoJSON
var subGeoJSONs = []
//geojson object holding all data in projectJSON
var projectGeoJSON = ''

//get omk submission w/request for projectName & save to projectName
var fetchSurvey = function(projectName) {
  request({
    method: 'GET',
    'auth': {
      'user': settings.app.user,
      'pass': settings.app.pass
    },
    uri: 'http://omkserver.com/omk/odk/submissions/' + projectName + '.json'
  },
  function(error, response, body) {
    // when no errors occur, save json to projectJSON
    if(!error && response.statusCode == 200) {
      projectJSON = JSON.parse(body);
    }
  })
}

//parse projectJSON, return all .osm files and object properties
var getSurveyOSMsProps = function(projectJSONobj) {
  for(var prop in projectJSONobj) {
    if(projectJSONobj.hasOwnProperty(prop)){
      var currentValue = projectJSONobj[prop]
      //if currentValue is an obj, 'go deep' ~ reqeat getSubOSMsProps
      if(typeof currentValue === 'object') {
        getSurveyOSMsProps(currentValue)
      }
      else {
        //when anything else, make it a string, see if it is .osm
        currentValue = currentValue.toString()
        if(currentValue.slice(-4).toLowerCase() === '.osm') {
          //when the osm file, set osmFile equal to it
          osmFile = currentValue;
          osmFileList.push(osmFile)
        }
      }
    }
  }
  osmFilesProps = {instanceId: [osmFileList,projectJSONobj]}
}



//get osm file from omk submission, and return osm file as geojson

//make it so it unpacks all osm files in the submission.
var fetchSurveyOSM = function(osmFilesProps,projectName) {
  for(i=0; i < osmFilesProps.instanceId[0].length; i++ ) {
    osm = osmFilesProps.instanceId[0][i]
    moreGeoJSONprops = osmFilesProps.instanceId[1]
    request({
      method: 'GET',
      'auth': {
        'user': settings.app.user,
        'pass': settings.app.pass
      },
      uri: 'http://omkserver.com/omk/data/submissions/' +
            projectName + '/' + instanceId + '/' + osm
    },
    function(error, response, body) {
      // when no errors occur, save json to projectJSON
      if(!error && response.statusCode == 200) {
        subOSM = body
        subGeoJSON = oag.osm2geojson(subOSM)
        extend(subGeoJSON.features[0].properties,moreGeoJSONprops)
      }
    })
    subGeoJSONs.push(subGeoJSON)
  }
}

// convert sub osms to geojson, put each sub's object into geojson properties //
var surveyOSMtoGeoJSON = function(projectJSON) {
  //iterate over objects, if contains osm, convert to / add props to geojson
  for(i=0; i < projectJSON.length; i++ ) {
    osmFile = null;
    osmFileList = []
    osmFilesProps = {}
    instanceId = projectJSON[i].meta.instanceId
    instanceId = instanceId.split("uuid:")[1]
    projectJSONobj = projectJSON[i]
    getSurveyOSMsProps(projectJSONobj)
    if(osmFile) {
      fetchSurveyOSM(osmFilesProps,projectName)
    }
  }
}

fetchSurvey(projectName)
surveyOSMtoGeoJSON(projectJSON)

projectGeoJSON = geojsonMerge.mergeFeatureCollectionStream(projectGeoJSONs)
