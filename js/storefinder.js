/*
 ipbSoft Store finder
 2015 Iván Pérez Brea.
*/

//Angular app declaration
var ipbsoftMap = angular.module('ipbsoftMap', ['uiGmapgoogle-maps', 'google.places']);

//Angular maps
ipbsoftMap
    .config(function(uiGmapGoogleMapApiProvider) {
        uiGmapGoogleMapApiProvider.configure({
            //    key: 'your api key',
            v: '3.20', //defaults to latest 3.X anyhow
            libraries: 'weather,geometry,visualization'
        });
    })
    
    .controller('mainController', ['$scope', '$http', 'uiGmapGoogleMapApi', '$window', function ($scope, $http, uiGmapGoogleMapApi, $window) {
        
        $scope.text = {};
        $scope.title = "title";
        $scope.showPanel = false;
        $scope.showNotFound = false;
        $scope.postcode;
        $scope.address = [];
        $scope.stores = {};
        $scope.currentStore = {};
        $scope.currentGroup = {};
        $scope.markers = [];
        $scope.groups = [];
        $scope.radius = 10000;
        $scope.cluster = 1;
        $scope.filter = [];
        $scope.filter.wifi = false;
        $scope.filter.disabled = false;
        $scope.wait = false;
        //-----------Autocomplete-----------//
        $scope.place = '';
        //--------------------------------//

        //This is an improvement for the google places autocomplete directive.
        //Event is not triggered when choose an option from the list
        $scope.$on('g-places-autocomplete:select', function (event, param) {
          $scope.autoSearch();
        });
        
        //Define cluster grouping
        $scope.type = 'cluster';
        var maxZoom = 12;
        var styles = [{
              textColor: 'white',
              url: 'img/group.png',
              height: 40,
              width: 40,
              textSize: 11,
              fontWeight: 'normal'
            }];    

        //Cluster grouping options
        $scope.clusterOptions = {
          gridSize: 80,
          maxZoom: maxZoom,
          averageCenter: true,
          styles: styles,
          zoomOnClick: true
        };
                

        uiGmapGoogleMapApi.then(function(maps) {
          /*This ugly piece of code is needed in order to fix a lodash issue*/
          if( typeof _.contains === 'undefined' ) {
            _.contains = _.includes;
          }
          if( typeof _.object === 'undefined' ) {
            _.object = _.zipObject;
          }
          /*-------------------------------------*/
            
            //Start point to center the map
            $scope.startLatitude = 52.000491;
            $scope.startLongitude = 4.641774;
            
            //Define map properties
            $scope.map = { 
                center: { latitude: $scope.startLatitude, longitude: $scope.startLongitude },
                zoom: 7,
                minZoom: 7,
                maxZoom: 10,
                zoomControl: true,
                mapTypeId: google.maps.MapTypeId.ROADMAP,
                disableDefaultUI: true,
                mapTypeControl: false,
                panControl: true,
                streetViewControl : false,
                overviewMapControl: false,
                overviewMapControlOptions: false,
            };
                     
            //get the stores info via json/apiRest
            $scope.getStores();
            
        });
        
        //Loads the markers all over the map
        $scope.loadMarkers = function() {
            $scope.markers = [];
            $scope.stores.forEach( function(store){
                        //Filters
                        if($scope.filter.wifi && store.wifi !== 'y') return;
                        if($scope.filter.disabled && store.disabled !== 'y') return;
                
                        //Filling out the markers array
                        $scope.marker = {};
                        $scope.marker.id = store.no;
                        $scope.marker.latitude = store.lat;
                        $scope.marker.longitude = store.lng;
                        $scope.marker.options = {
                            icon: {
                                url:'img/lebara_marker.png' 
                                ,scaledSize: new google.maps.Size(16, 27)}
                        };

                        //Marker event
                        $scope.marker.onClick = function(){
                            $scope.currentStore = store;
                            if(store.wifi == 'y') {
                                $scope.currentStore.wifi = true;
                            } 
                            if(store.disabled == 'y') {
                                $scope.currentStore.disabled = true;
                            } 
                            $scope.togglePanel($scope.currentStore);
                        };
                
                        //Push into the array
                        $scope.markers.push($scope.marker);
            });
        }
        
        //Get stores
        $scope.getStores = function() {
            $http.get('json/stores.json')
            .success(function (result) {
                $scope.stores = result.stores;
                $scope.loadMarkers();
            })
            .error(function (data, status) {
                console.log(data);
            });
        }
          
        //open left panel
        $scope.togglePanel = function(marker) {
            $scope.map.center = { latitude: parseFloat(marker.lat), longitude: parseFloat(marker.lng) };
            $scope.map.zoom = 13;
            $scope.showPanel = true;
        }
        
        //close left panel
        $scope.closePanel = function() {
            $scope.showPanel = false;
            $scope.map.zoom = $scope.map.zoom -1;
        }
        
        //Uses google geocode api to get the location position
        $scope.autoSearch = function() {
            console.log();
            setTimeout(function () {
                $scope.$apply(function () {
                    /*var placeEncoded = encodeURIComponent($scope.place);
                    $http.get('http://maps.google.com/maps/api/geocode/json?address=' 
                              + placeEncoded + '&sensor=false')
                    .success(function (result) {
                        var location = result.results[0].geometry.location;
                        $scope.map.center = { latitude: location.lat, longitude: location.lng };
                        $scope.map.zoom = 13;
                        $scope.sortByDistance(location.lat,location.lng);
                    })
                    .error(function (data, status) {
                        console.log('error:');
                        console.log(data);
                    });*/
                    
                    $scope.map.center = { latitude: $scope.place.geometry.location.lat(), longitude: $scope.place.geometry.location.lng() };
                    $scope.map.zoom = 13;
                    $scope.sortByDistance($scope.place.geometry.location.lat(),$scope.place.geometry.location.lng());
                    
                });
            }, 100);
        }
                                
        //Builds the url for google maps route
        $scope.getRouteUrl = function(store) {
            var url = 'https://www.google.com/maps/dir/Current+Location/[lat],[lng]';
            url = url.replace('[lat]', store.avg_y).replace('[lng]',store.avg_x);
            $window.open(url, '_blank');
        }
        
        //1. Gets the current positions based on html5 geolocation
        //2. Sort by distance the nearest stores
        //3. Draw a circle
        $scope.current_location = function() {
            
            // check for Geolocation support
            if (navigator.geolocation) {
                //console.log('Geolocation is supported!');
                $scope.wait = true;
                console.log('processing current location...');
                var geoError = function(error) {
                    console.log('Error occurred. Error code: ' + error.code);
                    // error.code can be:
                    //   0: unknown error
                    //   1: permission denied
                    //   2: position unavailable (error response from location provider)
                    //   3: timed out
                };

                navigator.geolocation.getCurrentPosition(function(position) {
                        $scope.$apply(function () {
                            $scope.map.center = { 
                                latitude: position.coords.latitude, 
                                longitude: position.coords.longitude 
                            };
                            $scope.map.zoom = 15;
                            $scope.wait = false;
                            
                            //Sort by distance
                            $scope.sortByDistance(position.coords.latitude, position.coords.longitude);
                            
                            //Draw the circle
                            $scope.circle = {
                                id: 1,
                                center: {
                                    latitude: position.coords.latitude,
                                    longitude: position.coords.longitude
                                },
                                radius: 500,
                                stroke: {
                                    color: '#08B21F',
                                    weight: 2,
                                    opacity: 0.5
                                },
                                fill: {
                                    color: '#08B21F',
                                    opacity: 0.2
                                },
                                geodesic: false, // optional: defaults to false
                                draggable: false, // optional: defaults to false
                                clickable: false, // optional: defaults to true
                                editable: false, // optional: defaults to false
                                visible: true, // optional: defaults to true
                                control: {}
                            }
                        });
                      
                  }, function(error) {
                        console.log('current position error:');
                        console.log(error.message);
                        $scope.$apply(function () {
                            $scope.wait = false;
                        });
                    },
                  {timeout: 8000}                                          
                );
            }
            else {
              console.log('Geolocation is not supported for this Browser/OS version yet.');
            }
        }
        
        
        $scope.showIcon = function(value) {
            if(value==1) {
                return true;
            }else {
                return false;
            }
        }
        
        //Round the distance in 2 decimals
        $scope.getRounded = function(distance) {
            //return Math.round(distance);
            return parseFloat(distance).toFixed(2);
        }
        
        
        
        //Sort the stores based on the distance
        $scope.sortByDistance = function(lat, lng) {
            
            //Calculate the distance for each store
            $scope.stores.forEach( function(store){
                store.distance = getDistance(lat, lng, store.lat, store.lng);
            });
            
            //Sort by distance
            $scope.stores.sort(function(a, b){return a.distance-b.distance});
        }
        
        
        //Haversine algorithm to calculate the distance between two points
        function getDistance(lat1,lon1,lat2,lon2) {
              var R = 6371; // Radius of the earth in km
              var dLat = deg2rad(lat2-lat1);  // deg2rad below
              var dLon = deg2rad(lon2-lon1); 
              var a = 
                Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
                Math.sin(dLon/2) * Math.sin(dLon/2)
                ; 
              var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
              var d = R * c; // Distance in km
              return d;
        }
        function deg2rad(deg) {
          return deg * (Math.PI/180)
        }

        
        
}]);



