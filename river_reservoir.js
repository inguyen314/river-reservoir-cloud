document.addEventListener('DOMContentLoaded', async function () {
    const currentDateTime = new Date();
    console.log("currentDateTime: ", currentDateTime);

    let setLocationCategory = null;
    let setLocationGroupOwner = null;
    let setTimeseriesGroup1 = null;
    let setTimeseriesGroup2 = null;
    let setTimeseriesGroup3 = null;
    let setTimeseriesGroup4 = null;
    let setTimeseriesGroup5 = null;
    let setLookBack = null;
    let setLookForward = null;
    let setReportDiv = null;

    let reportNumber = 1;

    if (reportNumber === 1) {
        console.log("***************************************************************");
        console.log("********************* Setup River Reservoir *******************");
        console.log("***************************************************************");
        // Set the category and base URL for API calls
        setReportDiv = "river_reservoir";
        setLocationCategory = "Basins";
        setLocationGroupOwner = "River-Reservoir";
        setTimeseriesGroup1 = "Stage";
        setTimeseriesGroup2 = "Forecast-NWS";
        setTimeseriesGroup3 = "Crest";
        setTimeseriesGroup4 = "Precip-Lake";
        setTimeseriesGroup5 = "Inflow-Yesterday-Lake";
        setLookBack = subtractDaysFromDate(new Date(), 2);
        setLookForward = addDaysFromDate(new Date(), 14);
    }

    // Display the loading indicator for water quality alarm
    const loadingIndicator = document.getElementById(`loading_${setReportDiv}`);
    loadingIndicator.style.display = 'block'; // Show the loading indicator

    console.log("setLocationCategory: ", setLocationCategory);
    console.log("setLocationGroupOwner: ", setLocationGroupOwner);
    console.log("setTimeseriesGroup1: ", setTimeseriesGroup1);
    console.log("setTimeseriesGroup2: ", setTimeseriesGroup2);
    console.log("setTimeseriesGroup3: ", setTimeseriesGroup3);
    console.log("setTimeseriesGroup4: ", setTimeseriesGroup4);
    console.log("setTimeseriesGroup5: ", setTimeseriesGroup5);
    console.log("setLookBack: ", setLookBack);

    let setBaseUrl = null;
    if (cda === "internal") {
        setBaseUrl = `https://wm.${office.toLowerCase()}.ds.usace.army.mil:8243/${office.toLowerCase()}-data/`;
        // console.log("setBaseUrl: ", setBaseUrl);
    } else if (cda === "public") {
        setBaseUrl = `https://cwms-data.usace.army.mil/cwms-data/`;
        // console.log("setBaseUrl: ", setBaseUrl);
    }

    // Define the URL to fetch location groups based on category
    const categoryApiUrl = setBaseUrl + `location/group?office=${office}&include-assigned=false&location-category-like=${setLocationCategory}`;
    // console.log("categoryApiUrl: ", categoryApiUrl);

    // Initialize maps to store metadata and time-series ID (TSID) data for various parameters
    const metadataMap = new Map();
    const floodMap = new Map();
    const lwrpMap = new Map();
    const ownerMap = new Map();
    const stageTsidMap = new Map();
    const riverMileMap = new Map();
    const forecastNwsTsidMap = new Map();
    const crestTsidMap = new Map();
    // const tainterTsidMap = new Map();
    // const rollerTsidMap = new Map();
    const recordStageMap = new Map();
    const precipLakeTsidMap = new Map();
    const inflowYesterdayLakeTsidMap = new Map();

    // Initialize arrays for storing promises
    const metadataPromises = [];
    const floodPromises = [];
    const lwrpPromises = [];
    const ownerPromises = [];
    const stageTsidPromises = [];
    const riverMilePromises = [];
    const forecastNwsTsidPromises = [];
    const hingePointTsidPromises = [];
    // const tainterTsidPromises = [];
    // const rollerTsidPromises = [];
    const recordStageTsidPromises = [];
    const precipLakeTsidPromises = [];
    const inflowYesterdayLakeTsidPromises = [];

    // Fetch location group data from the API
    fetch(categoryApiUrl)
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response was not ok');
            }
            return response.json();
        })
        .then(data => {
            if (!Array.isArray(data) || data.length === 0) {
                console.warn('No data available from the initial fetch.');
                return;
            }

            // Filter and map the returned data to basins belonging to the target category
            const targetCategory = { "office-id": office, "id": setLocationCategory };
            const filteredArray = filterByLocationCategory(data, targetCategory);
            let basins = filteredArray.map(item => item.id);
            console.log("basins: ", basins);

            // Set basins to current basin if set in the url
            // basins = basins.filter(basinId => basin.includes(basinId));
            // console.log("basins: ", basins);

            if (basins.length === 0) {
                console.warn('No basins found for the given category.');
                return;
            }

            // Initialize an array to store promises for fetching basin data
            const apiPromises = [];
            let combinedData = [];

            // Loop through each basin and fetch data for its assigned locations
            basins.forEach(basin => {
                const basinApiUrl = setBaseUrl + `location/group/${basin}?office=${office}&category-id=${setLocationCategory}`;
                // console.log("basinApiUrl: ", basinApiUrl);

                apiPromises.push(
                    fetch(basinApiUrl)
                        .then(response => {
                            if (!response.ok) {
                                throw new Error(`Network response was not ok for basin ${basin}: ${response.statusText}`);
                            }
                            return response.json();
                        })
                        .then(getBasin => {
                            // console.log('getBasin:', getBasin);

                            if (!getBasin) {
                                // console.log(`No data for basin: ${basin}`);
                                return;
                            }

                            // Filter and sort assigned locations based on 'attribute' field
                            getBasin[`assigned-locations`] = getBasin[`assigned-locations`].filter(location => location.attribute <= 900);
                            getBasin[`assigned-locations`].sort((a, b) => a.attribute - b.attribute);
                            combinedData.push(getBasin);

                            // If assigned locations exist, fetch metadata and time-series data
                            if (getBasin['assigned-locations']) {
                                getBasin['assigned-locations'].forEach(loc => {
                                    // Fetch data
                                    (() => {
                                        // Fetch river-mile
                                        (() => {
                                            riverMilePromises.push(
                                                fetch('json/gage_control_official.json')
                                                    .then(response => {
                                                        if (!response.ok) {
                                                            throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        }
                                                        return response.json();
                                                    })
                                                    .then(riverMilesJson => {
                                                        // Loop through each basin in the JSON
                                                        for (const basin in riverMilesJson) {
                                                            const locations = riverMilesJson[basin];

                                                            for (const loc in locations) {
                                                                const ownerData = locations[loc];
                                                                // console.log("ownerData: ", ownerData);

                                                                // Retrieve river mile and other data
                                                                const riverMile = ownerData.river_mile_hard_coded;

                                                                // Create an output object using the location name as ID
                                                                const outputData = {
                                                                    locationId: loc, // Using location name as ID
                                                                    basin: basin,
                                                                    riverMile: riverMile
                                                                };

                                                                // console.log("Output Data:", outputData);
                                                                riverMileMap.set(loc, ownerData); // Store the data in the map
                                                            }
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error('Problem with the fetch operation:', error);
                                                    })
                                            )
                                        })();

                                        // Fetch metadata
                                        (() => {
                                            const locApiUrl = setBaseUrl + `locations/${loc['location-id']}?office=${office}`;
                                            // console.log("locApiUrl: ", locApiUrl);
                                            metadataPromises.push(
                                                fetch(locApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) {
                                                            console.warn(`Location metadata not found for location: ${loc['location-id']}`);
                                                            return null; // Skip if not found
                                                        }
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(locData => {
                                                        if (locData) {
                                                            metadataMap.set(loc['location-id'], locData);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for location ${loc['location-id']}:`, error);
                                                    })
                                            );
                                        })();

                                        // Fetch flood
                                        (() => {
                                            // Fetch flood location level for each location
                                            const levelIdFlood = loc['location-id'] + ".Stage.Inst.0.Flood";
                                            // console.log("levelIdFlood: ", levelIdFlood);

                                            const levelIdEffectiveDate = "2024-01-01T08:00:00";
                                            // console.log("levelIdEffectiveDate: ", levelIdEffectiveDate);

                                            const floodApiUrl = setBaseUrl + `levels/${levelIdFlood}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ft`;
                                            // console.log("floodApiUrl: ", floodApiUrl);
                                            floodPromises.push(
                                                fetch(floodApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) {
                                                            console.warn(`Location metadata not found for location: ${loc['location-id']}`);
                                                            return null; // Skip if not found
                                                        }
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(floodData => {
                                                        if (floodData) {
                                                            floodMap.set(loc['location-id'], floodData);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for location ${loc['location-id']}:`, error);
                                                    })
                                            );
                                        })();

                                        // Fetch record stage
                                        (() => {
                                            // Fetch flood location level for each location
                                            const recordStageLevelId = loc['location-id'] + ".Stage.Inst.0.Record Stage";
                                            // console.log("recordStageLevelId: ", recordStageLevelId);

                                            const levelIdEffectiveDate = "2024-01-01T08:00:00";
                                            // console.log("levelIdEffectiveDate: ", levelIdEffectiveDate);

                                            const recordStageApiUrl = setBaseUrl + `levels/${recordStageLevelId}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ft`;
                                            // console.log("recordStageApiUrl: ", recordStageApiUrl);
                                            recordStageTsidPromises.push(
                                                fetch(recordStageApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) {
                                                            console.warn(`Location metadata not found for location: ${loc['location-id']}`);
                                                            return null; // Skip if not found
                                                        }
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(recordStageData => {
                                                        if (recordStageData) {
                                                            recordStageMap.set(loc['location-id'], recordStageData);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for location ${loc['location-id']}:`, error);
                                                    })
                                            );
                                        })();

                                        // Fetch lwrp
                                        (() => {
                                            // Fetch lwrp location level for each location
                                            const levelIdLwrp = loc['location-id'] + ".Stage.Inst.0.LWRP";
                                            // console.log("levelIdFlood: ", levelIdFlood);

                                            const levelIdEffectiveDate = "2024-01-01T08:00:00";
                                            // console.log("levelIdEffectiveDate: ", levelIdEffectiveDate);

                                            const lwrpApiUrl = setBaseUrl + `levels/${levelIdLwrp}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ft`;
                                            // console.log("lwrpApiUrl: ", lwrpApiUrl);
                                            lwrpPromises.push(
                                                fetch(lwrpApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) {
                                                            console.warn(`Location metadata not found for location: ${loc['location-id']}`);
                                                            return null; // Skip if not found
                                                        }
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(lwrpData => {
                                                        if (lwrpData) {
                                                            lwrpMap.set(loc['location-id'], lwrpData);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for location ${loc['location-id']}:`, error);
                                                    })
                                            );
                                        })();

                                        // Fetch owner
                                        (() => {
                                            // Fetch owner for each location
                                            let ownerApiUrl = setBaseUrl + `location/group/${setLocationGroupOwner}?office=${office}&category-id=${office}`;
                                            // console.log("ownerApiUrl: ", ownerApiUrl);
                                            if (ownerApiUrl) {
                                                ownerPromises.push(
                                                    fetch(ownerApiUrl)
                                                        .then(response => {
                                                            if (response.status === 404) {
                                                                console.warn(`Datman TSID data not found for location: ${loc['location-id']}`);
                                                                return null;
                                                            }
                                                            if (!response.ok) {
                                                                throw new Error(`Network response was not ok: ${response.statusText}`);
                                                            }
                                                            return response.json();
                                                        })
                                                        .then(ownerData => {
                                                            if (ownerData) {
                                                                // console.log("ownerData", ownerData);
                                                                ownerMap.set(loc['location-id'], ownerData);
                                                            }
                                                        })
                                                        .catch(error => {
                                                            console.error(`Problem with the fetch operation for stage TSID data at ${ownerApiUrl}:`, error);
                                                        })
                                                );
                                            }
                                        })();

                                        // Fetch stageTsidMap
                                        (() => {
                                            // Fetch datman TSID data
                                            const tsidStageApiUrl = setBaseUrl + `timeseries/group/${setTimeseriesGroup1}?office=${office}&category-id=${loc['location-id']}`;
                                            // console.log('tsidStageApiUrl:', tsidStageApiUrl);
                                            stageTsidPromises.push(
                                                fetch(tsidStageApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(tsidData => {
                                                        // // console.log('tsidData:', tsidData);
                                                        if (tsidData) {
                                                            stageTsidMap.set(loc['location-id'], tsidData);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidStageApiUrl}:`, error);
                                                    })
                                            );
                                        })();

                                        // Fetch forecastNwsTsidMap
                                        (() => {
                                            const tsidApiUrl = setBaseUrl + `timeseries/group/${setTimeseriesGroup2}?office=${office}&category-id=${loc['location-id']}`;
                                            // console.log('tsidApiUrl:', tsidApiUrl);
                                            forecastNwsTsidPromises.push(
                                                fetch(tsidApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(data => {
                                                        // // console.log('data:', data);
                                                        if (data) {
                                                            forecastNwsTsidMap.set(loc['location-id'], data);
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidApiUrl}:`, error);
                                                    })
                                            );
                                        })();

                                        // Fetch crestTsidMap
                                        (() => {
                                            // const tsidApiUrl = setBaseUrl + `timeseries/group/${setTimeseriesGroup3}?office=${office}&category-id=${loc['location-id']}`;
                                            // // console.log('tsidApiUrl:', tsidApiUrl);
                                            // hingePointTsidPromises.push(
                                            //     fetch(tsidApiUrl)
                                            //         .then(response => {
                                            //             if (response.status === 404) return null; // Skip if not found
                                            //             if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                            //             return response.json();
                                            //         })
                                            //         .then(data => {
                                            //             // // console.log('data:', data);
                                            //             if (data) {
                                            //                 crestTsidMap.set(loc['location-id'], data);
                                            //             }
                                            //         })
                                            //         .catch(error => {
                                            //             console.error(`Problem with the fetch operation for stage TSID data at ${tsidApiUrl}:`, error);
                                            //         })
                                            // );
                                        })();

                                        // Fetch precipLakeTsidMap
                                        (() => {
                                            const tsidApiUrl = setBaseUrl + `timeseries/group/${setTimeseriesGroup4}?office=${office}&category-id=${loc['location-id']}`;
                                            // console.log('tsidApiUrl:', tsidApiUrl);
                                            precipLakeTsidPromises.push( // Change Here
                                                fetch(tsidApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(data => {
                                                        // // console.log('data:', data);
                                                        if (data) {
                                                            precipLakeTsidMap.set(loc['location-id'], data); // Change Here
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidApiUrl}:`, error);
                                                    })
                                            );
                                        })();

                                        // Fetch inflowYesterdayLakeTsidMap
                                        (() => {
                                            const tsidApiUrl = setBaseUrl + `timeseries/group/${setTimeseriesGroup5}?office=${office}&category-id=${loc['location-id']}`;
                                            // console.log('tsidApiUrl:', tsidApiUrl);
                                            inflowYesterdayLakeTsidPromises.push( // Change Here
                                                fetch(tsidApiUrl)
                                                    .then(response => {
                                                        if (response.status === 404) return null; // Skip if not found
                                                        if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                                                        return response.json();
                                                    })
                                                    .then(data => {
                                                        // // console.log('data:', data);
                                                        if (data) {
                                                            inflowYesterdayLakeTsidMap.set(loc['location-id'], data); // Change Here
                                                        }
                                                    })
                                                    .catch(error => {
                                                        console.error(`Problem with the fetch operation for stage TSID data at ${tsidApiUrl}:`, error);
                                                    })
                                            );
                                        })();
                                    })();
                                });
                            }
                        })
                        .catch(error => {
                            console.error(`Problem with the fetch operation for basin ${basin}:`, error);
                        })
                );
            });

            // Process all the API calls and store the fetched data
            Promise.all(apiPromises)
                .then(() => Promise.all(metadataPromises))
                .then(() => Promise.all(floodPromises))
                .then(() => Promise.all(lwrpPromises))
                .then(() => Promise.all(ownerPromises))
                .then(() => Promise.all(stageTsidPromises))
                .then(() => Promise.all(riverMilePromises))
                .then(() => Promise.all(forecastNwsTsidPromises))
                .then(() => Promise.all(hingePointTsidPromises))
                // .then(() => Promise.all(tainterTsidPromises))
                // .then(() => Promise.all(rollerTsidPromises))
                .then(() => Promise.all(recordStageTsidPromises))
                .then(() => Promise.all(precipLakeTsidPromises))
                .then(() => Promise.all(inflowYesterdayLakeTsidPromises))
                .then(() => {
                    combinedData.forEach(basinData => {
                        if (basinData['assigned-locations']) {
                            basinData['assigned-locations'].forEach(loc => {
                                // Append metadata and tsid
                                (() => {
                                    // Append metadata
                                    const metadataMapData = metadataMap.get(loc['location-id']);
                                    if (metadataMapData) {
                                        loc['metadata'] = metadataMapData;
                                    }

                                    // Append flood
                                    const floodMapData = floodMap.get(loc['location-id']);
                                    loc['flood'] = floodMapData !== undefined ? floodMapData : null;

                                    // Append record stage
                                    const recordStageMapData = recordStageMap.get(loc['location-id']);
                                    loc['record-stage'] = recordStageMapData !== undefined ? recordStageMapData : null;

                                    // Append lwrp
                                    const lwrpMapData = lwrpMap.get(loc['location-id']);
                                    loc['lwrp'] = lwrpMapData !== undefined ? lwrpMapData : null;

                                    // Append river-mile
                                    const riverMileMapData = riverMileMap.get(loc['location-id']);
                                    if (riverMileMapData) {
                                        loc['river-mile'] = riverMileMapData;
                                    }

                                    // Append owner
                                    const ownerMapData = ownerMap.get(loc['location-id']);
                                    if (ownerMapData) {
                                        loc['owner'] = ownerMapData;
                                    }

                                    // Append tsid 1
                                    const stageTsidMapData = stageTsidMap.get(loc['location-id']);
                                    if (stageTsidMapData) {
                                        reorderByAttribute(stageTsidMapData);
                                        loc['tsid-stage'] = stageTsidMapData;
                                    } else {
                                        loc['tsid-stage'] = null;  // Append null if missing
                                    }

                                    // Append forecastNwsTsidMapData
                                    const forecastNwsTsidMapData = forecastNwsTsidMap.get(loc['location-id']);
                                    if (forecastNwsTsidMapData) {
                                        reorderByAttribute(forecastNwsTsidMapData);
                                        loc['tsid-forecast-nws'] = forecastNwsTsidMapData;
                                    } else {
                                        loc['tsid-forecast-nws'] = null;
                                    }

                                    // // Append crestTsidMapData
                                    // const crestTsidMapData = crestTsidMap.get(loc['location-id']);
                                    // if (crestTsidMapData) {
                                    //     reorderByAttribute(crestTsidMapData);
                                    //     loc['tsid-crest'] = crestTsidMapData;
                                    // } else {
                                    //     loc['tsid-crest'] = null;
                                    // }

                                    // Append precipLakeTsidMapData
                                    const precipLakeTsidMapData = precipLakeTsidMap.get(loc['location-id']);
                                    if (precipLakeTsidMapData) {
                                        reorderByAttribute(precipLakeTsidMapData);
                                        loc['tsid-precip-lake'] = precipLakeTsidMapData;
                                    } else {
                                        loc['tsid-precip-lake'] = null;
                                    }

                                    // Append inflowYesterdayLakeTsidMapData
                                    const inflowYesterdayLakeTsidMapData = inflowYesterdayLakeTsidMap.get(loc['location-id']);
                                    if (inflowYesterdayLakeTsidMapData) {
                                        reorderByAttribute(inflowYesterdayLakeTsidMapData);
                                        loc['tsid-inflow-yesterday-lake'] = inflowYesterdayLakeTsidMapData;
                                    } else {
                                        loc['tsid-inflow-yesterday-lake'] = null;
                                    }

                                    // Initialize empty arrays to hold API and last-value data for various parameters
                                    loc['stage-api-data'] = [];
                                    loc['stage-cum-value'] = [];
                                    loc['stage-hourly-value'] = [];
                                    loc['stage-inc-value'] = [];
                                    loc['stage-last-value'] = [];
                                    loc['stage-max-value'] = [];
                                    loc['stage-min-value'] = [];

                                    loc['forecast-nws-api-data'] = [];
                                    loc['forecast-nws-cum-value'] = [];
                                    loc['forecast-nws-hourly-value'] = [];
                                    loc['forecast-nws-inc-value'] = [];
                                    loc['forecast-nws-last-value'] = [];
                                    loc['forecast-nws-max-value'] = [];
                                    loc['forecast-nws-min-value'] = [];

                                    loc['crest-api-data'] = [];
                                    loc['crest-cum-value'] = [];
                                    loc['crest-hourly-value'] = [];
                                    loc['crest-inc-value'] = [];
                                    loc['crest-last-value'] = [];
                                    loc['crest-max-value'] = [];
                                    loc['crest-min-value'] = [];

                                    loc['precip-lake-api-data'] = [];
                                    loc['precip-lake-cum-value'] = [];
                                    loc['precip-lake-hourly-value'] = [];
                                    loc['precip-lake-inc-value'] = [];
                                    loc['precip-lake-last-value'] = [];
                                    loc['precip-lake-max-value'] = [];
                                    loc['precip-lake-min-value'] = [];

                                    loc['inflow-yesterday-lake-api-data'] = [];
                                    loc['inflow-yesterday-lake-cum-value'] = [];
                                    loc['inflow-yesterday-lake-hourly-value'] = [];
                                    loc['inflow-yesterday-lake-inc-value'] = [];
                                    loc['inflow-yesterday-lake-last-value'] = [];
                                    loc['inflow-yesterday-lake-max-value'] = [];
                                    loc['inflow-yesterday-lake-min-value'] = [];
                                })();
                            });
                        }
                    });

                    console.log('combinedData:', combinedData);

                    // Filter data
                    (() => {
                        // Step 1: Filter out locations where 'attribute' ends with '.1'
                        combinedData.forEach((dataObj, index) => {
                            // console.log(`Processing dataObj at index ${index}:`, dataObj['assigned-locations']);

                            // Filter out locations with 'attribute' ending in '.1'
                            dataObj['assigned-locations'] = dataObj['assigned-locations'].filter(location => {
                                const attribute = location['attribute'].toString();
                                if (attribute.endsWith('.1')) {
                                    // Log the location being removed
                                    // console.log(`Removing location with attribute '${attribute}' and id '${location['location-id']}' at index ${index}`);
                                    return false; // Filter out this location
                                }
                                return true; // Keep the location
                            });

                            // console.log(`Updated assigned-locations for index ${index}:`, dataObj['assigned-locations']);
                        });

                        console.log('Filtered all locations ending with .1 successfully:', combinedData);

                        // Step 2: Filter out locations where 'location-id' doesn't match owner's 'assigned-locations'
                        combinedData.forEach(dataGroup => {
                            // Check if 'assigned-locations' exists in dataGroup
                            if (!dataGroup['assigned-locations']) {
                                console.warn("dataGroup is missing 'assigned-locations'");
                                return; // Skip this iteration if 'assigned-locations' is missing
                            }

                            // Iterate over each assigned-location in the dataGroup
                            let locations = dataGroup['assigned-locations'];

                            // Loop through the locations array in reverse to safely remove items
                            for (let i = locations.length - 1; i >= 0; i--) {
                                let location = locations[i];

                                // Check if 'owner' and 'assigned-locations' are defined in the location object
                                if (!location['owner'] || !location['owner']['assigned-locations']) {
                                    console.warn(`Location with id ${location['location-id']} is missing owner or owner's assigned-locations`);
                                    locations.splice(i, 1); // Remove the location if owner or assigned-locations is missing
                                    continue;
                                }

                                // Find if the current location-id exists in owner's assigned-locations
                                let matchingOwnerLocation = location['owner']['assigned-locations'].some(ownerLoc => {
                                    return ownerLoc['location-id'] === location['location-id'];
                                });

                                // If no match, remove the location
                                if (!matchingOwnerLocation) {
                                    locations.splice(i, 1);
                                }
                            }
                        });


                        console.log('Filtered all locations by matching location-id with owner successfully:', combinedData);

                        // Step 3: Filter out locations where 'tsid-stage' is null
                        combinedData.forEach(dataGroup => {
                            // Iterate over each assigned-location in the dataGroup
                            let locations = dataGroup['assigned-locations'];

                            // Loop through the locations array in reverse to safely remove items
                            for (let i = locations.length - 1; i >= 0; i--) {
                                let location = locations[i];

                                // console.log("tsid-stage: ", location[`tsid-stage`]);

                                // Check if 'tsid-stage' is null or undefined
                                let isLocationNull = location[`tsid-stage`] == null;

                                // If tsid-stage is null, remove the location
                                if (isLocationNull) {
                                    console.log(`Removing location with id ${location['location-id']}`);
                                    locations.splice(i, 1); // Remove the location from the array
                                }
                            }
                        });

                        console.log('Filtered all locations where tsid is null successfully:', combinedData);

                        // Step 5: Filter out basin order
                        const sortOrderBasin = ['Mississippi', 'Illinois', 'Cuivre', 'Missouri', 'Meramec', 'Ohio', 'Kaskaskia', 'Big Muddy', 'St Francis', 'Salt'];

                        // Sort the combinedData array based on the sortOrderBasin
                        combinedData.sort((a, b) => {
                            const indexA = sortOrderBasin.indexOf(a.id); // Assuming 'id' represents the basin name
                            const indexB = sortOrderBasin.indexOf(b.id); // Assuming 'id' represents the basin name

                            // If both basins are found in the sortOrderBasin, sort based on their indices
                            if (indexA !== -1 && indexB !== -1) {
                                return indexA - indexB; // Sort based on order in sortOrderBasin
                            }
                            // If one is not found, put it at the end
                            return indexA === -1 ? 1 : -1;
                        });

                        // Log the sorted combinedData for verification
                        console.log("Sorted combinedData: ", combinedData);

                        // Step 4: Filter out basin where there are no gages
                        combinedData = combinedData.filter(item => item['assigned-locations'] && item['assigned-locations'].length > 0);

                        console.log('Filtered all basin where assigned-locations is null successfully:', combinedData);
                    })();

                    const timeSeriesDataPromises = [];

                    // Iterate over all arrays in combinedData
                    for (const dataArray of combinedData) {
                        for (const locData of dataArray['assigned-locations'] || []) {
                            // Handle temperature, depth, and DO time series
                            const stageTimeSeries = locData['tsid-stage']?.['assigned-time-series'] || [];
                            const twTimeSeries = locData['tsid-forecast-nws']?.['assigned-time-series'] || [];
                            const hingePointTimeSeries = locData['tsid-crest']?.['assigned-time-series'] || [];
                            const tainterTimeSeries = locData['tsid-tainter']?.['assigned-time-series'] || [];
                            const rollerTimeSeries = locData['tsid-roller']?.['assigned-time-series'] || [];
                            const precipLakeTimeSeries = locData['tsid-precip-lake']?.['assigned-time-series'] || [];
                            const inflowYesterdayLakeTimeSeries = locData['tsid-inflow-yesterday-lake']?.['assigned-time-series'] || [];
                            // Add Here

                            // Function to create fetch promises for time series data
                            const timeSeriesDataFetchPromises = (timeSeries, type) => {
                                return timeSeries.map((series, index) => {
                                    const tsid = series['timeseries-id'];
                                    const timeSeriesDataApiUrl = setBaseUrl + `timeseries?page-size=5000&name=${tsid}&begin=${setLookBack.toISOString()}&end=${setLookForward.toISOString()}&office=${office}`;
                                    // console.log('timeSeriesDataApiUrl:', timeSeriesDataApiUrl);

                                    return fetch(timeSeriesDataApiUrl, {
                                        method: 'GET',
                                        headers: {
                                            'Accept': 'application/json;version=2'
                                        }
                                    })
                                        .then(res => res.json())
                                        .then(data => {

                                            // console.log("data: ", data);

                                            if (data.values) {
                                                data.values.forEach(entry => {
                                                    entry[0] = formatISODate2ReadableDate(entry[0]);
                                                });
                                            }

                                            const lastValue = getLastNonNullValueWithDelta24hrs(data, tsid);
                                            const maxValue = getMaxValue(data, tsid);
                                            const minValue = getMinValue(data, tsid);
                                            const cumValue = getCumValue(data, tsid);
                                            const incValue = getIncValue(data, tsid);
                                            const day1NwsValue = getNoonDataForDay1(data, tsid);
                                            const day2NwsValue = getNoonDataForDay2(data, tsid);
                                            const day3NwsValue = getNoonDataForDay3(data, tsid);
                                            const hourlyValue = getHourlyDataOnTopOfHour(data, tsid);

                                            // console.log("day1NwsValue: ", day1NwsValue);

                                            updateLocData(locData, type, data, lastValue, maxValue, minValue, cumValue, incValue, hourlyValue, day1NwsValue, day2NwsValue, day3NwsValue);
                                        })

                                        .catch(error => {
                                            console.error(`Error fetching additional data for location ${locData['location-id']} with TSID ${tsid}:`, error);
                                        });
                                });
                            };

                            // Create promises for temperature, depth, and DO time series
                            const stagePromises = timeSeriesDataFetchPromises(stageTimeSeries, 'stage');
                            const twPromises = timeSeriesDataFetchPromises(twTimeSeries, 'forecast-nws');
                            const hingePointPromises = timeSeriesDataFetchPromises(hingePointTimeSeries, 'crest');
                            const tainterPromises = timeSeriesDataFetchPromises(tainterTimeSeries, 'tainter');
                            const rollerPromises = timeSeriesDataFetchPromises(rollerTimeSeries, 'roller');
                            const precipLakePromises = timeSeriesDataFetchPromises(precipLakeTimeSeries, 'precip-lake');
                            const inflowYesterdayLakePromises = timeSeriesDataFetchPromises(inflowYesterdayLakeTimeSeries, 'inflow-yesterday-lake');
                            // Add Here

                            // Additional API call for extents data
                            const timeSeriesDataExtentsApiCall = async (type) => {
                                const extentsApiUrl = setBaseUrl + `catalog/TIMESERIES?page-size=5000&office=${office}`;
                                // console.log('extentsApiUrl:', extentsApiUrl);

                                try {
                                    const res = await fetch(extentsApiUrl, {
                                        method: 'GET',
                                        headers: {
                                            'Accept': 'application/json;version=2'
                                        }
                                    });
                                    const data = await res.json();
                                    locData['extents-api-data'] = data;
                                    locData[`extents-data`] = {};

                                    // Collect TSIDs from temp, depth, and DO time series
                                    const stageTids = stageTimeSeries.map(series => series['timeseries-id']);
                                    const twTids = twTimeSeries.map(series => series['timeseries-id']);
                                    const hingePointTids = twTimeSeries.map(series => series['timeseries-id']);
                                    const tainterTids = tainterTimeSeries.map(series => series['timeseries-id']);
                                    const rollerTids = rollerTimeSeries.map(series => series['timeseries-id']);
                                    const precipLakeTids = precipLakeTimeSeries.map(series => series['timeseries-id']);
                                    const inflowYesterdayLakeTids = inflowYesterdayLakeTimeSeries.map(series => series['timeseries-id']);
                                    // Add Here
                                    const allTids = [...stageTids, ...twTids, ...hingePointTids, ...tainterTids, ...rollerTids, ...precipLakeTids, ...inflowYesterdayLakeTids]; // Add Here

                                    allTids.forEach((tsid, index) => {
                                        const matchingEntry = data.entries.find(entry => entry['name'] === tsid);
                                        if (matchingEntry) {
                                            // Convert times from UTC
                                            let latestTimeUTC = matchingEntry.extents[0]?.['latest-time'];
                                            let earliestTimeUTC = matchingEntry.extents[0]?.['earliest-time'];

                                            // Convert UTC times to Date objects
                                            let latestTimeCST = new Date(latestTimeUTC);
                                            let earliestTimeCST = new Date(earliestTimeUTC);

                                            // Function to format date as "MM-DD-YYYY HH:mm"
                                            const formatDate = (date) => {
                                                return date.toLocaleString('en-US', {
                                                    timeZone: 'America/Chicago', // Set the timezone to Central Time (CST/CDT)
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    year: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                    hour12: false // Use 24-hour format
                                                }).replace(',', ''); // Remove the comma from the formatted string
                                            };

                                            // Format the times to CST/CDT
                                            let formattedLatestTime = formatDate(latestTimeCST);
                                            let formattedEarliestTime = formatDate(earliestTimeCST);

                                            // Construct the _data object with formatted times
                                            let _data = {
                                                office: matchingEntry.office,
                                                name: matchingEntry.name,
                                                earliestTime: formattedEarliestTime, // Use formatted earliestTime
                                                earliestTimeISO: earliestTimeCST.toISOString(), // Store original ISO format as well
                                                lastUpdate: matchingEntry.extents[0]?.['last-update'],
                                                latestTime: formattedLatestTime, // Use formatted latestTime
                                                latestTimeISO: latestTimeCST.toISOString(), // Store original ISO format as well
                                                tsid: matchingEntry['timeseries-id'],
                                            };

                                            // Determine extent key based on tsid
                                            let extent_key;
                                            if (tsid.includes('Precip') || tsid.includes('Stage') || tsid.includes('Elev') || tsid.includes('Flow') || tsid.includes('Conc-DO')) {
                                                extent_key = 'datman';
                                            } else {
                                                return; // Ignore if it doesn't match the condition
                                            }

                                            // Update locData with extents-data
                                            if (!locData[`extents-data`][extent_key]) {
                                                locData[`extents-data`][extent_key] = [_data];
                                            } else {
                                                locData[`extents-data`][extent_key].push(_data);
                                            }

                                        } else {
                                            console.warn(`No matching entry found for TSID: ${tsid}`);
                                        }
                                    });
                                } catch (error) {
                                    console.error(`Error fetching additional data for location ${locData['location-id']}:`, error);
                                }
                            };

                            // Combine all promises for this location 
                            // Add Here
                            timeSeriesDataPromises.push(Promise.all([...stagePromises, ...twPromises, ...hingePointPromises, ...tainterPromises, ...rollerPromises, ...precipLakePromises, timeSeriesDataExtentsApiCall()]));
                        }
                    }

                    // Wait for all additional data fetches to complete
                    return Promise.all(timeSeriesDataPromises);
                })
                .then(() => {
                    console.log('All combinedData data fetched successfully:', combinedData);

                    // Get the current time in JavaScript)
                    const now = new Date();
                    const timestamp = now.getTime();
                    const date = new Date(timestamp);

                    // Day 1
                    var day1 = new Date(timestamp);
                    day1.setDate(date.getDate() + 1);
                    var nws_day1_date = ('0' + (day1.getMonth() + 1)).slice(-2) + '-' + ('0' + day1.getDate()).slice(-2) + '-' + day1.getFullYear();
                    var nws_day1_date_title = ('0' + (day1.getMonth() + 1)).slice(-2) + '-' + ('0' + day1.getDate()).slice(-2);
                    // console.log('nws_day1_date: ', nws_day1_date);
                    // console.log('nws_day1_date_title: ', nws_day1_date_title);

                    // Day 2
                    var day2 = new Date(date);
                    day2.setDate(date.getDate() + 2);
                    var nws_day2_date = ('0' + (day2.getMonth() + 1)).slice(-2) + '-' + ('0' + day2.getDate()).slice(-2) + '-' + day2.getFullYear();
                    var nws_day2_date_title = ('0' + (day2.getMonth() + 1)).slice(-2) + '-' + ('0' + day2.getDate()).slice(-2);
                    // console.log('nws_day2_date: ', nws_day2_date);
                    // console.log('nws_day2_date_title: ', nws_day2_date_title);

                    // Day 3
                    var day3 = new Date(date);
                    day3.setDate(date.getDate() + 3);
                    var nws_day3_date = ('0' + (day3.getMonth() + 1)).slice(-2) + '-' + ('0' + day3.getDate()).slice(-2) + '-' + day3.getFullYear();
                    var nws_day3_date_title = ('0' + (day3.getMonth() + 1)).slice(-2) + '-' + ('0' + day3.getDate()).slice(-2);
                    // console.log('nws_day3_date: ', nws_day3_date);
                    // console.log('nws_day3_date_title: ', nws_day3_date_title);

                    // Create a deep copy of combinedData
                    const combinedDataRiver = structuredClone ? structuredClone(combinedData) : JSON.parse(JSON.stringify(combinedData));

                    const combinedDataReservoir = structuredClone ? structuredClone(combinedData) : JSON.parse(JSON.stringify(combinedData));

                    // Create the first table
                    const table1 = createTableRiver(combinedDataRiver, type, reportNumber, nws_day1_date_title, nws_day2_date_title, nws_day3_date_title);

                    // Create the second table (you could use a similar function or a separate one)
                    const table2 = createTableReservoir(combinedDataReservoir, type, reportNumber, nws_day1_date_title, nws_day2_date_title, nws_day3_date_title);

                    // Append both tables to the specified container
                    const container = document.getElementById(`table_container_${setReportDiv}`);
                    container.appendChild(table1);
                    container.appendChild(table2);

                    loadingIndicator.style.display = 'none';
                })
                .catch(error => {
                    console.error('There was a problem with one or more fetch operations:', error);
                    loadingIndicator.style.display = 'none';
                });
        })
        .catch(error => {
            console.error('There was a problem with the initial fetch operation:', error);
            loadingIndicator.style.display = 'none';
        });
});

function filterByLocationCategory(array, setLocationCategory) {
    return array.filter(item =>
        item['location-category'] &&
        item['location-category']['office-id'] === setLocationCategory['office-id'] &&
        item['location-category']['id'] === setLocationCategory['id']
    );
}

function subtractHoursFromDate(date, hoursToSubtract) {
    return new Date(date.getTime() - (hoursToSubtract * 60 * 60 * 1000));
}

function subtractDaysFromDate(date, daysToSubtract) {
    return new Date(date.getTime() - (daysToSubtract * 24 * 60 * 60 * 1000));
}

function addDaysFromDate(date, daysToSubtract) {
    return new Date(date.getTime() + (daysToSubtract * 24 * 60 * 60 * 1000));
}

function formatISODate2ReadableDate(timestamp) {
    const date = new Date(timestamp);
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // Month
    const dd = String(date.getDate()).padStart(2, '0'); // Day
    const yyyy = date.getFullYear(); // Year
    const hh = String(date.getHours()).padStart(2, '0'); // Hours
    const min = String(date.getMinutes()).padStart(2, '0'); // Minutes
    return `${mm}-${dd}-${yyyy} ${hh}:${min}`;
}

const reorderByAttribute = (data) => {
    data['assigned-time-series'].sort((a, b) => a.attribute - b.attribute);
};

const formatTime = (date) => {
    const pad = (num) => (num < 10 ? '0' + num : num);
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
};

const findValuesAtTimes = (data) => {
    const result = [];
    const currentDate = new Date();

    // Create time options for 5 AM, 6 AM, and 7 AM today in Central Standard Time
    const timesToCheck = [
        new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 6, 0), // 6 AM CST
        new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 5, 0), // 5 AM CST
        new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate(), 7, 0)  // 7 AM CST
    ];

    const foundValues = [];

    // Iterate over the values in the provided data
    const values = data.values;

    // Check for each time in the order of preference
    timesToCheck.forEach((time) => {
        // Format the date-time to match the format in the data
        const formattedTime = formatTime(time);
        // console.log(formattedTime);

        const entry = values.find(v => v[0] === formattedTime);
        if (entry) {
            foundValues.push({ time: formattedTime, value: entry[1] }); // Store both time and value if found
        } else {
            foundValues.push({ time: formattedTime, value: null }); // Store null if not found
        }
    });

    // Push the result for this data entry
    result.push({
        name: data.name,
        values: foundValues // This will contain the array of { time, value } objects
    });

    return result;
};

function getLastNonNullValue(data, tsid) {
    // Iterate over the values array in reverse
    for (let i = data.values.length - 1; i >= 0; i--) {
        // Check if the value at index i is not null
        if (data.values[i][1] !== null) {
            // Return the non-null value as separate variables
            return {
                tsid: tsid,
                timestamp: data.values[i][0],
                value: data.values[i][1],
                qualityCode: data.values[i][2]
            };
        }
    }
    // If no non-null value is found, return null
    return null;
}

function getLastNonNullValueWithDelta24hrs(data, tsid) {
    let lastNonNull = null;
    let secondLastNonNull = null;
    const ONE_DAY_MS = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    // Iterate over the values array in reverse to find the last non-null value
    for (let i = data.values.length - 1; i >= 0; i--) {
        const [timestamp, value, qualityCode] = data.values[i];

        if (value !== null) {
            if (!lastNonNull) {
                // Store the most recent non-null value
                lastNonNull = { timestamp, value, qualityCode };
            } else {
                // Check if this non-null value is exactly 24 hours before the last one
                const lastTimestamp = new Date(lastNonNull.timestamp).getTime();
                const currentTimestamp = new Date(timestamp).getTime();
                const timeDifference = lastTimestamp - currentTimestamp;

                if (timeDifference === ONE_DAY_MS) {
                    secondLastNonNull = { timestamp, value, qualityCode };
                    break;
                }
            }
        }
    }

    if (lastNonNull) {
        return {
            tsid: tsid,
            timestamp: lastNonNull.timestamp || null,
            value: lastNonNull.value !== null ? lastNonNull.value : null,
            value24hrs: secondLastNonNull && secondLastNonNull.value !== null ? secondLastNonNull.value : null,
            qualityCode: lastNonNull.qualityCode !== null ? lastNonNull.qualityCode : null,
            delta: secondLastNonNull && lastNonNull.value !== null && secondLastNonNull.value !== null
                ? lastNonNull.value - secondLastNonNull.value
                : null
        };
    }

    // If no matching values were found, return null
    return null;
}

function getMaxValue(data, tsid) {
    let maxValue = -Infinity; // Start with the smallest possible value
    let maxEntry = null; // Store the corresponding max entry (timestamp, value, quality code)

    // Loop through the values array
    for (let i = 0; i < data.values.length; i++) {
        // Check if the value at index i is not null
        if (data.values[i][1] !== null) {
            // Update maxValue and maxEntry if the current value is greater
            if (data.values[i][1] > maxValue) {
                maxValue = data.values[i][1];
                maxEntry = {
                    tsid: tsid,
                    timestamp: data.values[i][0],
                    value: data.values[i][1],
                    qualityCode: data.values[i][2]
                };
            }
        }
    }

    // Return the max entry (or null if no valid values were found)
    return maxEntry;
}

function getMinValue(data, tsid) {
    let minValue = Infinity; // Start with the largest possible value
    let minEntry = null; // Store the corresponding min entry (timestamp, value, quality code)

    // Loop through the values array
    for (let i = 0; i < data.values.length; i++) {
        // Check if the value at index i is not null
        if (data.values[i][1] !== null) {
            // Update minValue and minEntry if the current value is smaller
            if (data.values[i][1] < minValue) {
                minValue = data.values[i][1];
                minEntry = {
                    tsid: tsid,
                    timestamp: data.values[i][0],
                    value: data.values[i][1],
                    qualityCode: data.values[i][2]
                };
            }
        }
    }

    // Return the min entry (or null if no valid values were found)
    return minEntry;
}

function getCumValue(data, tsid) {
    let value0 = null;  // Recent (0 hours)
    let value6 = null;  // 6 hours earlier
    let value12 = null; // 12 hours earlier
    let value18 = null; // 18 hours earlier
    let value24 = null; // 24 hours earlier
    let value30 = null; // 30 hours earlier
    let value36 = null; // 36 hours earlier
    let value42 = null; // 42 hours earlier
    let value48 = null; // 48 hours earlier
    let value54 = null; // 54 hours earlier
    let value60 = null; // 60 hours earlier
    let value66 = null; // 66 hours earlier
    let value72 = null; // 72 hours earlier

    // Iterate over the values array in reverse
    for (let i = data.values.length - 1; i >= 0; i--) {
        const [timestamp, value, qualityCode] = data.values[i];

        // Check if the value at index i is not null
        if (value !== null) {
            // Convert timestamp to Date object
            const currentTimestamp = new Date(timestamp);
            // console.log("currentTimestamp: ", currentTimestamp);

            // If value0 hasn't been set, set it to the latest non-null value
            if (!value0) {
                value0 = { tsid, timestamp, value, qualityCode };
            } else {
                // Calculate target timestamps for each interval
                const sixHoursEarlier = new Date(value0.timestamp);
                sixHoursEarlier.setHours(sixHoursEarlier.getHours() - 6);

                const twelveHoursEarlier = new Date(value0.timestamp);
                twelveHoursEarlier.setHours(twelveHoursEarlier.getHours() - 12);

                const eighteenHoursEarlier = new Date(value0.timestamp);
                eighteenHoursEarlier.setHours(eighteenHoursEarlier.getHours() - 18);

                const twentyFourHoursEarlier = new Date(value0.timestamp);
                twentyFourHoursEarlier.setHours(twentyFourHoursEarlier.getHours() - 24);

                const thirtyHoursEarlier = new Date(value0.timestamp);
                thirtyHoursEarlier.setHours(thirtyHoursEarlier.getHours() - 30);

                const thirtySixHoursEarlier = new Date(value0.timestamp);
                thirtySixHoursEarlier.setHours(thirtySixHoursEarlier.getHours() - 36);

                const fortyTwoHoursEarlier = new Date(value0.timestamp);
                fortyTwoHoursEarlier.setHours(fortyTwoHoursEarlier.getHours() - 42);

                const fortyEightHoursEarlier = new Date(value0.timestamp);
                fortyEightHoursEarlier.setHours(fortyEightHoursEarlier.getHours() - 48);

                const fiftyFourHoursEarlier = new Date(value0.timestamp);
                fiftyFourHoursEarlier.setHours(fiftyFourHoursEarlier.getHours() - 54);

                const sixtyHoursEarlier = new Date(value0.timestamp);
                sixtyHoursEarlier.setHours(sixtyHoursEarlier.getHours() - 60);

                const sixtySixHoursEarlier = new Date(value0.timestamp);
                sixtySixHoursEarlier.setHours(sixtySixHoursEarlier.getHours() - 66);

                const seventyTwoHoursEarlier = new Date(value0.timestamp);
                seventyTwoHoursEarlier.setHours(seventyTwoHoursEarlier.getHours() - 72);

                // Assign values if the timestamps match
                if (!value6 && currentTimestamp.getTime() === sixHoursEarlier.getTime()) {
                    value6 = { tsid, timestamp, value, qualityCode };
                } else if (!value12 && currentTimestamp.getTime() === twelveHoursEarlier.getTime()) {
                    value12 = { tsid, timestamp, value, qualityCode };
                } else if (!value18 && currentTimestamp.getTime() === eighteenHoursEarlier.getTime()) {
                    value18 = { tsid, timestamp, value, qualityCode };
                } else if (!value24 && currentTimestamp.getTime() === twentyFourHoursEarlier.getTime()) {
                    value24 = { tsid, timestamp, value, qualityCode };
                } else if (!value30 && currentTimestamp.getTime() === thirtyHoursEarlier.getTime()) {
                    value30 = { tsid, timestamp, value, qualityCode };
                } else if (!value36 && currentTimestamp.getTime() === thirtySixHoursEarlier.getTime()) {
                    value36 = { tsid, timestamp, value, qualityCode };
                } else if (!value42 && currentTimestamp.getTime() === fortyTwoHoursEarlier.getTime()) {
                    value42 = { tsid, timestamp, value, qualityCode };
                } else if (!value48 && currentTimestamp.getTime() === fortyEightHoursEarlier.getTime()) {
                    value48 = { tsid, timestamp, value, qualityCode };
                } else if (!value54 && currentTimestamp.getTime() === fiftyFourHoursEarlier.getTime()) {
                    value54 = { tsid, timestamp, value, qualityCode };
                } else if (!value60 && currentTimestamp.getTime() === sixtyHoursEarlier.getTime()) {
                    value60 = { tsid, timestamp, value, qualityCode };
                } else if (!value66 && currentTimestamp.getTime() === sixtySixHoursEarlier.getTime()) {
                    value66 = { tsid, timestamp, value, qualityCode };
                } else if (!value72 && currentTimestamp.getTime() === seventyTwoHoursEarlier.getTime()) {
                    value72 = { tsid, timestamp, value, qualityCode };
                }

                // Break loop if all values are found
                if (
                    value6 &&
                    value12 &&
                    value18 &&
                    value24 &&
                    value30 &&
                    value36 &&
                    value42 &&
                    value48 &&
                    value54 &&
                    value60 &&
                    value66 &&
                    value72
                ) {
                    break;
                }
            }
        }
    }

    // Calculate incremental values (valueX - valuePrevious)
    // const incrementalValues = {
    //     incremental6: value6 ? value0.value - value6.value : null,
    //     incremental12: value12 ? value6.value - value12.value : null,
    //     incremental18: value18 ? value12.value - value18.value : null,
    //     incremental24: value24 ? value18.value - value24.value : null,
    //     incremental30: value30 ? value24.value - value30.value : null,
    //     incremental36: value36 ? value30.value - value36.value : null,
    //     incremental42: value42 ? value36.value - value42.value : null,
    //     incremental48: value48 ? value42.value - value48.value : null,
    //     incremental54: value54 ? value48.value - value54.value : null,
    //     incremental60: value60 ? value54.value - value60.value : null,
    //     incremental66: value66 ? value60.value - value66.value : null,
    //     incremental72: value72 ? value66.value - value72.value : null,
    // };

    // Calculate cumulative values (value0 - valueX)
    const cumulativeValues = {
        cumulative6: value0 && value6 ? value0.value - value6.value : null,
        cumulative12: value0 && value12 ? value0.value - value12.value : null,
        cumulative24: value0 && value24 ? value0.value - value24.value : null,
        cumulative48: value0 && value48 ? value0.value - value48.value : null,
        cumulative72: value0 && value72 ? value0.value - value72.value : null,
    };

    return {
        value0,
        value6,
        value12,
        value18,
        value24,
        value30,
        value36,
        value42,
        value48,
        value54,
        value60,
        value66,
        value72,
        // ...incrementalValues, // Spread operator to include incremental values in the return object
        ...cumulativeValues // Spread operator to include cumulative values in the return object
    };
}

function getIncValue(data, tsid) {
    let value0 = null;  // Recent (0 hours)
    let value6 = null;  // 6 hours earlier
    let value12 = null; // 12 hours earlier
    let value18 = null; // 18 hours earlier
    let value24 = null; // 24 hours earlier
    let value30 = null; // 30 hours earlier
    let value36 = null; // 36 hours earlier
    let value42 = null; // 42 hours earlier
    let value48 = null; // 48 hours earlier
    let value54 = null; // 54 hours earlier
    let value60 = null; // 60 hours earlier
    let value66 = null; // 66 hours earlier
    let value72 = null; // 72 hours earlier

    // Iterate over the values array in reverse
    for (let i = data.values.length - 1; i >= 0; i--) {
        const [timestamp, value, qualityCode] = data.values[i];

        // Check if the value at index i is not null
        if (value !== null) {
            // Convert timestamp to Date object
            const currentTimestamp = new Date(timestamp);

            // If value0 hasn't been set, set it to the latest non-null value
            if (!value0) {
                value0 = { tsid, timestamp, value, qualityCode };
            } else {
                // Calculate target timestamps for each interval
                const intervals = [6, 12, 18, 24, 30, 36, 42, 48, 54, 60, 66, 72];
                const valuesMap = [value6, value12, value18, value24, value30, value36, value42, value48, value54, value60, value66, value72];

                intervals.forEach((interval, idx) => {
                    const targetTime = new Date(value0.timestamp);
                    targetTime.setHours(targetTime.getHours() - interval);
                    if (!valuesMap[idx] && currentTimestamp.getTime() === targetTime.getTime()) {
                        valuesMap[idx] = { tsid, timestamp, value, qualityCode };
                    }
                });

                // Break loop if all values are found
                if (valuesMap.every(val => val !== null)) {
                    break;
                }
            }
        }
    }

    // Calculate incremental values (valueX - valuePrevious) if both values are not null
    const incrementalValues = {
        incremental6: value6 && value0 ? value0.value - value6.value : null,
        incremental12: value12 && value6 ? value6.value - value12.value : null,
        incremental18: value18 && value12 ? value12.value - value18.value : null,
        incremental24: value24 && value18 ? value18.value - value24.value : null,
        incremental30: value30 && value24 ? value24.value - value30.value : null,
        incremental36: value36 && value30 ? value30.value - value36.value : null,
        incremental42: value42 && value36 ? value36.value - value42.value : null,
        incremental48: value48 && value42 ? value42.value - value48.value : null,
        incremental54: value54 && value48 ? value48.value - value54.value : null,
        incremental60: value60 && value54 ? value54.value - value60.value : null,
        incremental66: value66 && value60 ? value60.value - value66.value : null,
        incremental72: value72 && value66 ? value66.value - value72.value : null,
    };

    return {
        value0,
        value6,
        value12,
        value18,
        value24,
        value30,
        value36,
        value42,
        value48,
        value54,
        value60,
        value66,
        value72,
        ...incrementalValues
    };
}

function getHourlyDataOnTopOfHour(data, tsid) {
    const hourlyData = [];

    data.values.forEach(entry => {
        const [timestamp, value, qualityCode] = entry;
        const date = new Date(timestamp);

        // Check if the time is exactly at the top of the hour
        if (date.getMinutes() === 0) {
            // Append tsid to the object
            hourlyData.push({ timestamp, value, qualityCode, tsid });
        }
    });

    return hourlyData;
}

function getNoonDataForDay1(data, tsid) {
    const noonData = [];
    const day1 = new Date();
    day1.setDate(day1.getDate() + 1); // Move to the next day (Day 1)
    day1.setHours(12, 0, 0, 0); // Set to 12:00 (noon) on Day 1

    data.values.forEach(entry => {
        const [timestamp, value, qualityCode] = entry;
        const date = new Date(timestamp);

        // Check if the timestamp is exactly 12:00 on Day 1
        if (date.getTime() === day1.getTime()) {
            // Append tsid to the object
            noonData.push({ timestamp, value, qualityCode, tsid });
        }
    });

    return noonData;
}

function getNoonDataForDay2(data, tsid) {
    const noonData = [];
    const day1 = new Date();
    day1.setDate(day1.getDate() + 2); // Move to the next day (Day 1)
    day1.setHours(12, 0, 0, 0); // Set to 12:00 (noon) on Day 1

    data.values.forEach(entry => {
        const [timestamp, value, qualityCode] = entry;
        const date = new Date(timestamp);

        // Check if the timestamp is exactly 12:00 on Day 1
        if (date.getTime() === day1.getTime()) {
            // Append tsid to the object
            noonData.push({ timestamp, value, qualityCode, tsid });
        }
    });

    return noonData;
}

function getNoonDataForDay3(data, tsid) {
    const noonData = [];
    const day1 = new Date();
    day1.setDate(day1.getDate() + 3); // Move to the next day (Day 1)
    day1.setHours(12, 0, 0, 0); // Set to 12:00 (noon) on Day 1

    data.values.forEach(entry => {
        const [timestamp, value, qualityCode] = entry;
        const date = new Date(timestamp);

        // Check if the timestamp is exactly 12:00 on Day 1
        if (date.getTime() === day1.getTime()) {
            // Append tsid to the object
            noonData.push({ timestamp, value, qualityCode, tsid });
        }
    });

    return noonData;
}

function hasLastValue(data) {
    let allLocationsValid = true; // Flag to track if all locations are valid

    // Iterate through each key in the data object
    for (const locationIndex in data) {
        if (data.hasOwnProperty(locationIndex)) { // Ensure the key belongs to the object
            const item = data[locationIndex];
            // console.log(`Checking basin ${parseInt(locationIndex) + 1}:`, item); // Log the current item being checked

            const assignedLocations = item['assigned-locations'];
            // Check if assigned-locations is an object
            if (typeof assignedLocations !== 'object' || assignedLocations === null) {
                // console.log('No assigned-locations found in basin:', item);
                allLocationsValid = false; // Mark as invalid since no assigned locations are found
                continue; // Skip to the next basin
            }

            // Iterate through each location in assigned-locations
            for (const locationName in assignedLocations) {
                const location = assignedLocations[locationName];
                // console.log(`Checking location: ${locationName}`, location); // Log the current location being checked

                // Check if location['tsid-temp-water'] exists, if not, set tempWaterTsidArray to an empty array
                const datmanTsidArray = (location['tsid-stage'] && location['tsid-stage']['assigned-time-series']) || [];
                const datmanLastValueArray = location['stage-last-value'];
                // console.log("datmanTsidArray: ", datmanTsidArray);
                // console.log("datmanLastValueArray: ", datmanLastValueArray);

                // Check if 'stage-last-value' exists and is an array
                let hasValidValue = false;

                if (Array.isArray(datmanTsidArray) && datmanTsidArray.length > 0) {
                    // console.log('datmanTsidArray has data.');

                    // Loop through the datmanLastValueArray and check for null or invalid entries
                    for (let i = 0; i < datmanLastValueArray.length; i++) {
                        const entry = datmanLastValueArray[i];
                        // console.log("Checking entry: ", entry);

                        // Step 1: If the entry is null, set hasValidValue to false
                        if (entry === null) {
                            // console.log(`Entry at index ${i} is null and not valid.`);
                            hasValidValue = false;
                            continue; // Skip to the next iteration, this is not valid
                        }

                        // Step 2: If the entry exists, check if the value is valid
                        if (entry.value !== null && entry.value !== 'N/A' && entry.value !== undefined) {
                            // console.log(`Valid entry found at index ${i}:`, entry);
                            hasValidValue = true; // Set to true only if we have a valid entry
                        } else {
                            // console.log(`Entry at index ${i} has an invalid value:`, entry.value);
                            hasValidValue = false; // Invalid value, so set it to false
                        }
                    }

                    // console.log("hasValidValue: ", hasValidValue);

                    // Log whether a valid entry was found
                    if (hasValidValue) {
                        // console.log("There are valid entries in the array.");
                    } else {
                        // console.log("There are invalid entries found in the array.");
                    }
                } else {
                    // console.log(`datmanTsidArray is either empty or not an array for location ${locationName}.`);
                }

                // If no valid values found in the current location, mark as invalid
                if (!hasValidValue) {
                    allLocationsValid = false; // Set flag to false if any location is invalid
                }
            }
        }
    }

    // Return true only if all locations are valid
    if (allLocationsValid) {
        console.log('All locations have valid entries.');
        return true;
    } else {
        console.log('Some locations are missing valid entries.');
        return false;
    }
}

function createTablePrecip(combinedData, type, reportNumber) {
    const table = document.createElement('table');
    table.setAttribute('id', 'gage_data');

    const headerRow = document.createElement('tr');
    let columns;

    // Set columns based on type
    if (type === "inc") {
        columns = ["River Mile", "Location", "06 hr.", "12 hr.", "18 hr.", "24 hr.", "30 hr.", "36 hr.", "42 hr.", "48 hr.", "54 hr.", "60 hr.", "66 hr.", "72 hr.", "Zero hr."];
    } else if (type === "cum") {
        columns = ["River Mile", "Location", "06 hr.", "12 hr.", "24 hr.", "48 hr.", "72 hr.", "Zero hr."];
    }

    // Create header cells
    columns.forEach((columnName) => {
        const th = document.createElement('th');
        th.textContent = columnName;
        th.style.height = '50px';
        th.style.backgroundColor = 'darkblue';
        th.style.color = 'white'; // Added for better visibility
        headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Populate table rows with data
    combinedData.forEach((basin) => {
        basin['assigned-locations'].forEach((location) => {
            const row = document.createElement('tr');

            const riverMileCell = document.createElement('td');
            const riverMileValue = location['river-mile'] && location['river-mile']['river_mile_hard_coded'];
            riverMileCell.textContent = riverMileValue != null ? parseFloat(riverMileValue).toFixed(1) : "N/A";


            // Set the title for the cell
            riverMileCell.title = "Hard Coded with Json File";

            // Set halo effect using text-shadow with orange color
            riverMileCell.style.textShadow = '0 0 2px rgba(255, 165, 0, 0.7), 0 0 2px rgba(255, 140, 0, 0.5)';
            row.appendChild(riverMileCell);

            // Location cell with link
            const value0 = location['stage-inc-value'][0]?.value0;
            const tsid = value0 ? value0.tsid : '';
            const link = `https://wm.mvs.ds.usace.army.mil/district_templates/chart/index.html?office=MVS&cwms_ts_id=${tsid}&cda=internal&lookback=7`;
            const locationCell = document.createElement('td');
            const linkElement = document.createElement('a');
            linkElement.href = link;
            linkElement.target = '_blank';
            linkElement.textContent = location['location-id'];
            locationCell.appendChild(linkElement);
            row.appendChild(locationCell);

            let dataValues;
            if (type === "inc") {
                dataValues = location['stage-inc-value'][0];

                // Handle incremental values
                const valueKeys = ["incremental6", "incremental12", "incremental18", "incremental24", "incremental30", "incremental36", "incremental42", "incremental48", "incremental54", "incremental60", "incremental66", "incremental72"];
                valueKeys.forEach((timeKey) => {
                    const cell = document.createElement('td');
                    const value = dataValues[timeKey];
                    const numericValue = (value !== undefined && value !== null) ? Number(value) : NaN; // Convert to number

                    // Set cell text
                    cell.textContent = !isNaN(numericValue) ? numericValue.toFixed(2) : 'N/A';

                    // Set background color based on value conditions
                    if (!isNaN(numericValue)) {
                        if (numericValue > 2.00 || numericValue < 0.00) {
                            cell.style.backgroundColor = 'red';
                        } else if (numericValue === 0.00) {
                            cell.style.backgroundColor = 'white';
                        } else if (numericValue > 0.00 && numericValue <= 0.25) {
                            cell.style.backgroundColor = 'limegreen';
                        } else if (numericValue > 0.25 && numericValue <= 0.50) {
                            cell.style.backgroundColor = 'sandybrown';
                        } else if (numericValue > 0.50 && numericValue <= 1.00) {
                            cell.style.backgroundColor = 'gold';
                        } else if (numericValue > 1.00 && numericValue <= 2.00) {
                            cell.style.backgroundColor = 'orange';
                        } else {
                            cell.style.backgroundColor = 'purple';
                        }
                    }

                    row.appendChild(cell);
                });

                // Zero hour cell
                const zeroHourCell = document.createElement('td');
                zeroHourCell.textContent = dataValues.value0 ? dataValues.value0.timestamp : 'N/A';
                row.appendChild(zeroHourCell);

            } else if (type === "cum") {
                dataValues = location['stage-cum-value'][0];
                ["cumulative6", "cumulative12", "cumulative24", "cumulative48", "cumulative72"].forEach((timeKey) => {
                    const cell = document.createElement('td');
                    const value = dataValues[timeKey];
                    const numericValue = (value !== undefined && value !== null) ? Number(value) : NaN; // Convert to number
                    cell.textContent = !isNaN(numericValue) ? numericValue.toFixed(2) : 'N/A';

                    // Set background color based on value conditions
                    if (!isNaN(numericValue)) {
                        if (numericValue > 2.00 || numericValue < 0.00) {
                            cell.style.backgroundColor = 'red';
                        } else if (numericValue === 0.00) {
                            cell.style.backgroundColor = 'white';
                        } else if (numericValue > 0.00 && numericValue <= 0.25) {
                            cell.style.backgroundColor = 'limegreen';
                        } else if (numericValue > 0.25 && numericValue <= 0.50) {
                            cell.style.backgroundColor = 'sandybrown';
                        } else if (numericValue > 0.50 && numericValue <= 1.00) {
                            cell.style.backgroundColor = 'gold';
                        } else if (numericValue > 1.00 && numericValue <= 2.00) {
                            cell.style.backgroundColor = 'orange';
                        } else {
                            cell.style.backgroundColor = 'purple';
                        }
                    }

                    row.appendChild(cell);
                });

                // Zero hour cell
                const zeroHourCell = document.createElement('td');
                zeroHourCell.textContent = dataValues.value0 ? dataValues.value0.timestamp : 'N/A';
                row.appendChild(zeroHourCell);
            }

            // Append row to table
            table.appendChild(row);
        });
    });

    return table;
}

function createTableLdGateSummary(combinedData, type, reportNumber) {
    // Create a new table element and set its ID
    const table = document.createElement('table');
    table.setAttribute('id', 'gage_data');

    // Loop through each basin in the combined data
    combinedData.forEach((basin) => {
        // Loop through each assigned location in the basin
        basin['assigned-locations'].forEach((location) => {
            // console.log("location-id: ", location['location-id']);

            // Create a row for the location ID spanning 6 columns
            const locationRow = document.createElement('tr');
            const locationCell = document.createElement('th');
            locationCell.colSpan = 6; // Set colspan to 6 for location ID
            locationCell.textContent = location['location-id'];
            locationCell.style.height = '50px'; // Set the height of the locationCell
            locationRow.appendChild(locationCell);
            table.appendChild(locationRow); // Append the location row to the table

            // Create a header row for the data columns
            const headerRow = document.createElement('tr');
            const columns = ["Date Time", "Pool", "Tail Water", "Hinge Point", "Tainter", "Roller"];
            columns.forEach((columnName) => {
                const th = document.createElement('th');
                th.textContent = columnName; // Set the header text
                th.style.height = '40px'; // Set the height of the header
                th.style.backgroundColor = 'darkblue'; // Set background color
                th.style.color = 'white'; // Set text color
                headerRow.appendChild(th); // Append header cells to the header row
            });
            table.appendChild(headerRow); // Append the header row to the table

            // Loop through stage-hourly-value and other values to add data rows
            location['stage-hourly-value'][0].forEach((entry, index) => {
                const row = document.createElement('tr'); // Create a new row for each entry

                // Fetch the dateTime for the current entry
                const dateTime = entry?.timestamp || "N/A";

                // Check if the current timestamp matches any poolValue timestamp
                const poolValueEntry = location['stage-hourly-value'][0].find(poolValue => poolValue.timestamp === dateTime);
                const poolValue = poolValueEntry ? poolValueEntry.value.toFixed(2) : "--"; // Use "--" if no match

                // Match timestamps and grab values for tailWaterValue, hingePointValue, tainterValue, and rollerValue
                const tailWaterEntry = location['forecast-nws-hourly-value']?.[0]?.find(tailWater => tailWater.timestamp === dateTime);
                const tailWaterValue = tailWaterEntry ? tailWaterEntry.value.toFixed(2) : "--"; // Use "--" if no match

                const hingePointEntry = location['crest-hourly-value']?.[0]?.find(hingePoint => hingePoint.timestamp === dateTime);
                const hingePointValue = hingePointEntry ? hingePointEntry.value.toFixed(2) : "--"; // Use "--" if no match

                const tainterEntry = location['tainter-hourly-value']?.[0]?.find(tainter => tainter.timestamp === dateTime);
                const tainterValue = tainterEntry ? tainterEntry.value.toFixed(2) : "--"; // Use "--" if no match

                const rollerEntry = location['roller-hourly-value']?.[0]?.find(roller => roller.timestamp === dateTime);
                const rollerValue = rollerEntry ? rollerEntry.value.toFixed(2) : "--"; // Use "--" if no match

                // Create and append cells to the row for each value
                [dateTime, poolValue, tailWaterValue, hingePointValue, tainterValue, rollerValue].forEach((value) => {
                    const cell = document.createElement('td'); // Create a new cell for each value
                    cell.textContent = value; // Set the cell text
                    row.appendChild(cell); // Append the cell to the row
                });

                // Append the data row to the table
                table.appendChild(row);
            });

            // Add a spacer row after each location's data rows for visual separation
            const spacerRow = document.createElement('tr'); // Create a new row for spacing
            const spacerCell = document.createElement('td'); // Create a cell for the spacer
            spacerCell.colSpan = 6; // Set colspan to 6 for the spacer cell
            spacerCell.style.height = '20px'; // Set height for the spacer
            spacerRow.appendChild(spacerCell); // Append the spacer cell to the spacer row
            table.appendChild(spacerRow); // Append the spacer row to the table
        });
    });

    return table; // Return the completed table
}

function createTableRiver(combinedDataRiver, type, reportNumber, nws_day1_date_title, nws_day2_date_title, nws_day3_date_title) {
    // Create a table element and set an ID for styling or selection purposes
    const table = document.createElement('table');
    table.setAttribute('id', 'webrep');

    combinedDataRiver = combinedDataRiver.filter((basin) => {
        // Ensure 'assigned-locations' exists before proceeding
        if (!Array.isArray(basin['assigned-locations'])) {
            return false; // Filter out basins without 'assigned-locations'
        }

        // Filter 'assigned-locations' within each basin
        basin['assigned-locations'] = basin['assigned-locations'].filter((location) => {
            const currentLocationId = location['location-id'];
            const locationList = location['owner']?.['assigned-locations'];

            // Check if currentLocationId exists in locationList with attribute === 1
            const foundInLocationList = locationList?.some(
                loc => loc['location-id'] === currentLocationId && loc['attribute'] === 1
            );

            // Remove location if attribute is 1, keep it otherwise
            return !foundInLocationList;
        });

        // Return true if there are remaining assigned-locations, otherwise filter out the basin
        return basin['assigned-locations'].length > 0;
    });

    // Add 3-rows title
    (() => {
        // TITLE ROW 1
        // Insert the first header row (main headers) for the table
        const headerRow = table.insertRow(0);

        // Define the main column headers
        const columns = ["River Mile", "Gage Station", "Current Level", "24hr Delta",
            "National Weather Service River Forecast", "Flood Level",
            "Gage Zero", "Record Stage", "Record Date"];

        // Create and append headers for each main column
        columns.forEach((columnName) => {
            const th = document.createElement('th');
            th.textContent = columnName;

            // Set row spans or column spans based on header requirements
            if (columnName === "River Mile" || columnName === "Gage Station" ||
                columnName === "Current Level" || columnName === "24hr Delta" ||
                columnName === "Flood Level" || columnName === "Gage Zero" ||
                columnName === "Record Stage" || columnName === "Record Date") {
                th.rowSpan = 3;
            }

            // Set colspan for the "National Weather Service River Forecast" column
            if (columnName === "National Weather Service River Forecast") {
                th.colSpan = 6;  // Adjusted to span across the 3 "Next 3 days" columns and 3 additional sub-columns
            }

            // Apply styling for header cells
            th.style.backgroundColor = 'darkblue';
            th.style.color = 'white';
            headerRow.appendChild(th);
        });

        // TITLE ROW 2
        // Insert the second header row for sub-headers under "National Weather Service River Forecast"
        const headerRow2 = table.insertRow(1);

        // Define sub-headers for the forecast columns
        const columns2 = ["Next 3 days", "forecast time", "Crest", "Date"];

        columns2.forEach((columnName) => {
            const th = document.createElement('th');
            th.textContent = columnName;
            th.style.backgroundColor = 'darkblue';
            th.style.color = 'white';

            // Set colspan for "Next 3 days" to include Day1, Day2, and Day3
            if (columnName === "Next 3 days") {
                th.colSpan = 3;
            } else {
                th.rowSpan = 2;
            }
            headerRow2.appendChild(th);
        });

        // TITLE ROW 3
        // Insert the third header row to show individual day headers under "Next 3 days"
        const headerRow3 = table.insertRow(2);

        // Define columns for the individual days under "Next 3 days"
        const dayColumns = ["Day1", "Day2", "Day3"];

        dayColumns.forEach((day) => {
            const th = document.createElement('th');
            th.textContent = day;
            th.style.backgroundColor = 'darkblue';
            th.style.color = 'white';
            headerRow3.appendChild(th);
        });
    })();

    // Loop through each basin in the combined data
    combinedDataRiver.forEach((basin) => {
        const basinRow = document.createElement('tr');
        const basinCell = document.createElement('th');
        basinCell.colSpan = 14;
        basinCell.textContent = basin[`id`];
        basinCell.style.height = '30px';
        basinCell.style.textAlign = 'left'; // Align text to the left
        basinCell.style.paddingLeft = '10px'; // Add left padding of 10px
        basinRow.appendChild(basinCell);
        table.appendChild(basinRow);

        basin['assigned-locations'].forEach((location) => {
            const row = document.createElement('tr');

            // 01 - River Mile
            (() => {
                const riverMileCell = document.createElement('td');
                const riverMileValue = location['river-mile'] && location['river-mile']['river_mile_hard_coded'];
                riverMileCell.textContent = riverMileValue != null ? parseFloat(riverMileValue).toFixed(1) : "N/A";
                // Set the title for the cell
                riverMileCell.title = "Hard Coded with Json File";
                // Set halo effect using text-shadow with orange color
                riverMileCell.style.textShadow = '0 0 2px rgba(255, 165, 0, 0.7), 0 0 2px rgba(255, 140, 0, 0.5)';
                row.appendChild(riverMileCell);
            })();

            // 02 - Gage Station
            (() => {
                // Location cell without link
                const locationCell = document.createElement('td');
                // locationCell.textContent = location['location-id'];
                locationCell.textContent = location['location-id'].split('-')[0];
                row.appendChild(locationCell);
            })();

            // 03 - Current Level
            (() => {
                // Ensure 'stage-last-value' exists and has at least one entry
                const stageLastValue = location['stage-last-value'] && location['stage-last-value'][0];
                if (!stageLastValue || !stageLastValue['tsid']) {
                    console.warn("Missing 'tsid' or 'stage-last-value' data for location:", location);
                    return; // Exit early if data is missing
                }

                // Create the link element for current level
                const tsid = stageLastValue['tsid'];
                const link = `https://wm.mvs.ds.usace.army.mil/apps/chart/index.html?&office=MVS&cwms_ts_id=${tsid}&cda=internal&lookback=4&lookforward=0`;
                const currentLevelCell = document.createElement('td');
                const linkElement = document.createElement('a');
                linkElement.href = link;
                linkElement.target = '_blank';

                const currentLevel = stageLastValue['value'];
                const floodValue = location['flood'] ? location['flood']['constant-value'] : null;
                const recordStage = location['record-stage'];
                const recordStageValue = recordStage ? recordStage['constant-value'] : null;

                // Set text content and styles based on flood and recordStage thresholds
                if (currentLevel != null) {
                    const formattedLevel = currentLevel.toFixed(2);
                    linkElement.textContent = formattedLevel;

                    if (recordStageValue !== null && currentLevel >= recordStageValue) {
                        linkElement.classList.add('record_breaking'); // Add "alert" class when currentLevel >= recordStageValue
                    }

                    if (floodValue != null && currentLevel >= floodValue) {
                        linkElement.style.color = 'red';  // Make text red if currentLevel exceeds floodValue
                    }
                } else {
                    linkElement.textContent = '';  // Display an empty string if currentLevel is null
                }

                currentLevelCell.appendChild(linkElement);
                row.appendChild(currentLevelCell);
            })();

            // 04 - 24hr Delta
            (() => {
                const deltaCell = document.createElement('td');

                // Ensure 'stage-last-value' exists, is an array, and has at least one entry
                const stageLastValue = location['stage-last-value'] && Array.isArray(location['stage-last-value']) && location['stage-last-value'][0];

                // If stageLastValue is valid, get 'delta', otherwise default to null
                const deltaValue = stageLastValue ? stageLastValue['delta'] : null;

                // Display the delta value, or 'N/A' if delta is not available
                deltaCell.textContent = deltaValue != null ? parseFloat(deltaValue).toFixed(2) : 'N/A';
                row.appendChild(deltaCell);
            })();

            // 05 - Day1
            (() => {
                // Create the cell for NWS Day 1 forecast value
                const nwsDay1Cell = document.createElement('td');

                // Safely retrieve and format the forecast value for Day 1
                const day1Value = location?.['forecast-nws-day1-nws-value']?.[0]?.[0]?.value;
                const floodValue = location['flood'] ? location['flood']['constant-value'] : null;
                const recordStageValue = location['record-stage'] ? location['record-stage']['constant-value'] : null;

                // Set text content and styles based on flood and recordStage thresholds
                if (day1Value != null) {
                    const formattedDay1Value = day1Value.toFixed(2);
                    nwsDay1Cell.textContent = formattedDay1Value;

                    if (recordStageValue !== null && day1Value >= recordStageValue) {
                        nwsDay1Cell.classList.add('record_breaking'); // Add "record_breaking" class if day1Value >= recordStageValue
                    }

                    if (floodValue != null && day1Value >= floodValue) {
                        nwsDay1Cell.style.color = 'red'; // Make text red if day1Value exceeds floodValue
                    }
                } else {
                    nwsDay1Cell.textContent = ''; // Display an empty string if day1Value is null
                }

                // Append the cell to the row
                row.appendChild(nwsDay1Cell);
            })();

            // 06 - Day2
            (() => {
                // Create the cell for NWS Day 2 forecast value
                const nwsDay2Cell = document.createElement('td');

                // Safely retrieve and format the forecast value for Day 2
                const day2Value = location?.['forecast-nws-day2-nws-value']?.[0]?.[0]?.value;
                const floodValue = location['flood'] ? location['flood']['constant-value'] : null;
                const recordStageValue = location['record-stage'] ? location['record-stage']['constant-value'] : null;
                const formattedDay2Value = day2Value != null ? day2Value.toFixed(2) : '';

                // Set text content and styles based on flood and recordStage thresholds
                nwsDay2Cell.textContent = formattedDay2Value;

                if (day2Value != null) {
                    if (recordStageValue !== null && day2Value >= recordStageValue) {
                        nwsDay2Cell.classList.add('record_breaking'); // Add "record_breaking" class if day2Value >= recordStageValue
                    }
                    if (floodValue != null && day2Value >= floodValue) {
                        nwsDay2Cell.style.color = 'red'; // Make text red if day2Value exceeds floodValue
                    }
                }

                // Append the cell to the row
                row.appendChild(nwsDay2Cell);
            })();

            // 07 - Day3
            (() => {
                // Create the cell for NWS Day 3 forecast value
                const nwsDay3Cell = document.createElement('td');

                // Safely retrieve and format the forecast value for Day 3
                const day3Value = location?.['forecast-nws-day3-nws-value']?.[0]?.[0]?.value;
                const floodValue = location['flood'] ? location['flood']['constant-value'] : null;
                const recordStageValue = location['record-stage'] ? location['record-stage']['constant-value'] : null;
                const formattedDay3Value = day3Value != null ? day3Value.toFixed(2) : '';

                // Set text content and styles based on flood and recordStage thresholds
                nwsDay3Cell.textContent = formattedDay3Value;

                if (day3Value != null) {
                    if (recordStageValue !== null && day3Value >= recordStageValue) {
                        nwsDay3Cell.classList.add('record_breaking'); // Add "record_breaking" class if day3Value >= recordStageValue
                    }
                    if (floodValue != null && day3Value >= floodValue) {
                        nwsDay3Cell.style.color = 'red'; // Make text red if day3Value exceeds floodValue
                    }
                }

                // Append the cell to the row
                row.appendChild(nwsDay3Cell);
            })();

            // 08 - Nws Forecast Time
            (() => {
                const nwsForecastTimeCell = document.createElement('td');
                const tsid_stage_nws_3_day_forecast = location['tsid-forecast-nws']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (tsid_stage_nws_3_day_forecast !== null) {
                    fetchAndLogNwsData(tsid_stage_nws_3_day_forecast, nwsForecastTimeCell);
                } else {
                    nwsForecastTimeCell.textContent = '';
                }

                row.appendChild(nwsForecastTimeCell);
            })();

            // 09 - Crest Value
            (() => {
                const crestValueCell = document.createElement('td');
                const crest = location['crest-last-value']?.[0]?.['value'] ?? null;
                const crestValue = crest !== null ? Number(crest) : null;

                if (crestValue !== null && !isNaN(crestValue)) {
                    crestValueCell.textContent = crestValue.toFixed(2);
                } else {
                    crestValueCell.textContent = '';
                }

                row.appendChild(crestValueCell);
            })();

            // 10 - Crest Date
            (() => {
                const crestDateCell = document.createElement('td');
                const crestDate = location['crest-last-value']?.[0]?.['timestamp'] ?? null;

                if (crestDate !== null) {
                    crestDateCell.textContent = crestDate.substring(0, 5);
                } else {
                    crestDateCell.textContent = '';
                }

                row.appendChild(crestDateCell);
            })();

            // 11 - Flood Level
            (() => {
                const floodLevelCell = document.createElement('td');

                // Check if 'flood' exists and has 'constant-value'
                const floodValue = location['flood'] ? location['flood']['constant-value'] : null;

                // Display the flood value if it's valid, otherwise set to 'N/A' or leave empty
                if (floodValue != null && floodValue <= 900) {
                    floodLevelCell.textContent = floodValue.toFixed(2);
                } else {
                    floodLevelCell.textContent = ''; // Leave it empty if floodValue > 900 or is null
                }

                row.appendChild(floodLevelCell);
            })();

            // 12 - Gage Zero
            (() => {
                const gageZeroCell = document.createElement('td');
                const gageZeroValue = location['metadata']?.['elevation'];
                const datum = location['metadata']?.['vertical-datum'];

                // Ensure gageZeroValue is a valid number before calling toFixed
                if (typeof gageZeroValue === 'number' && !isNaN(gageZeroValue)) {
                    gageZeroCell.textContent = (gageZeroValue > 900) ? '' : gageZeroValue.toFixed(2);
                } else {
                    gageZeroCell.textContent = 'N/A';  // Set to 'N/A' if gageZeroValue is invalid
                }

                // Check if datum is "NGVD29" and set text color to purple
                if (datum === "NGVD29") {
                    gageZeroCell.style.color = 'purple';
                }

                row.appendChild(gageZeroCell);
            })();

            // 13 - Record Stage
            (() => {
                const recordStageCell = document.createElement('td');
                const recordStage = location['record-stage'];
                const recordStageValue = recordStage ? recordStage['constant-value'] : null;
            
                // Check if recordStageValue is valid and within the required range
                if (recordStageValue != null && recordStageValue <= 900) {
                    recordStageCell.textContent = recordStageValue.toFixed(2);
                } else {
                    recordStageCell.textContent = 'N/A';  // Show 'N/A' if no valid recordStageValue
                }
            
                row.appendChild(recordStageCell);
            })();            

            // 14 - Record Date
            (() => {
                const recordDateCell = document.createElement('td');
            
                // Retrieve the record stage date value, or use null if not available
                const recordDateValue = location['river-mile'] && location['river-mile']['record_stage_date_hard_coded'];
            
                // Set the text content of the cell, default to an empty string if no data
                recordDateCell.textContent = recordDateValue != null ? recordDateValue : "";
            
                // Set the title for the cell
                recordDateCell.title = "Hard Coded with Json File";
            
                // Set halo effect using text-shadow with orange color
                recordDateCell.style.textShadow = '0 0 2px rgba(255, 165, 0, 0.7), 0 0 2px rgba(255, 140, 0, 0.5)';
            
                // Append the cell to the row
                row.appendChild(recordDateCell);
            })();            

            table.appendChild(row);
        });
    });

    // Return the constructed table element
    return table;
}

function createTableReservoir(combinedDataReservoir, type, reportNumber, nws_day1_date_title, nws_day2_date_title, nws_day3_date_title) {
    // Create a table element
    const table = document.createElement('table');
    table.setAttribute('id', 'webreplake');

    console.log("combinedDataReservoir (before): ", combinedDataReservoir);

    // Filter out locations with attribute === 1 in owner, and remove basins without assigned-locations
    combinedDataReservoir = combinedDataReservoir.filter((basin) => {
        // Filter 'assigned-locations' within each basin
        basin['assigned-locations'] = basin['assigned-locations'].filter((location) => {
            const currentLocationId = location['location-id'];

            // Check if 'owner' and 'assigned-locations' exist before accessing them
            const locationList = location['owner'] && Array.isArray(location['owner']['assigned-locations'])
                ? location['owner']['assigned-locations']
                : [];

            // Check if currentLocationId exists in locationList with attribute === 1
            const foundInLocationList = locationList.some(
                loc => loc['location-id'] === currentLocationId && loc['attribute'] === 1
            );

            if (!foundInLocationList) {
                // console.log("Removing location with ID:", currentLocationId);
            }
            // Remove location if attribute is 1, keep it otherwise
            return foundInLocationList;
        });

        // Return true if there are remaining assigned-locations, otherwise filter out the basin
        const hasLocations = basin['assigned-locations'].length > 0;
        if (!hasLocations) {
            // console.log("Removing empty basin:", basin);
        }
        return hasLocations;
    });

    console.log("combinedDataReservoir (after): ", combinedDataReservoir);

    // Add 3-rows title
    (() => {
        // TITLE ROW 1
        // Create a table header row
        const headerRow = table.insertRow(0);

        // Create table headers for the desired columns
        const columns = ["Lake", "Current Level", "24hr Delta", "Storage Utilized", "Precip (in)", "Yesterdays Inflow (dsf)", "Controlled Outflow", "Seasonal Rule Curve", "Pool Forecast", "Record Stage", "Record Date"];

        columns.forEach((columnName) => {
            const th = document.createElement('th');
            th.textContent = columnName;
            if (["Lake", "Current Level", "24hr Delta", "Precip (in)", "Yesterdays Inflow (dsf)", "Seasonal Rule Curve", "Record Stage", "Record Date"].includes(columnName)) {
                th.rowSpan = 2;
            }
            if (["Storage Utilized", "Controlled Outflow", "Pool Forecast"].includes(columnName)) {
                th.colSpan = 2;
            }
            th.style.backgroundColor = 'darkblue'; // Set background color to dark blue
            headerRow.appendChild(th);
        });

        // TITLE ROW 2
        // Create a table header row
        const headerRowLake2 = table.insertRow(1);

        // Create table headers for the desired columns
        const columns2 = ["Storage Utilized", "Controlled Outflow", "Pool Forecast"];

        columns2.forEach((columnName) => {
            if (columnName === "Storage Utilized") {
                const thStorageConsr = document.createElement('th');
                thStorageConsr.textContent = "Consr";
                thStorageConsr.style.backgroundColor = 'darkblue'; // Set background color to dark blue
                headerRowLake2.appendChild(thStorageConsr);

                const thStorageFlood = document.createElement('th');
                thStorageFlood.textContent = "Flood";
                thStorageFlood.style.backgroundColor = 'darkblue'; // Set background color to dark blue
                headerRowLake2.appendChild(thStorageFlood);
            }
            if (columnName === "Controlled Outflow") {
                const thMidnightOutflow = document.createElement('th');
                thMidnightOutflow.textContent = "Midnight";
                thMidnightOutflow.style.backgroundColor = 'darkblue'; // Set background color to dark blue
                headerRowLake2.appendChild(thMidnightOutflow);

                const thEveningOutflow = document.createElement('th');
                thEveningOutflow.textContent = "Evening";
                thEveningOutflow.style.backgroundColor = 'darkblue'; // Set background color to dark blue
                headerRowLake2.appendChild(thEveningOutflow);
            }
            if (columnName === "Pool Forecast") {
                const thForecastCrest = document.createElement('th');
                thForecastCrest.textContent = "Crest";
                thForecastCrest.style.backgroundColor = 'darkblue'; // Set background color to dark blue
                headerRowLake2.appendChild(thForecastCrest);

                const thForecastDate = document.createElement('th');
                thForecastDate.textContent = "Date";
                thForecastDate.style.backgroundColor = 'darkblue'; // Set background color to dark blue
                headerRowLake2.appendChild(thForecastDate);
            }
        });
    })();

    // Loop through each basin in the combined data
    combinedDataReservoir.forEach((basin) => {
        basin['assigned-locations'].forEach((location) => {
            const row = document.createElement('tr');

            // 01 - Lake
            (() => {
                const lakeCell = document.createElement('td');
                const lakeValue = location['location-id'].split('-')[0];
                lakeCell.textContent = lakeValue;
                row.appendChild(lakeCell);
            })();

            // 02 - Current Level
            (() => {
                // Check if 'stage-last-value' exists, is an array, and has the necessary properties
                const tsid = (location['stage-last-value'] && Array.isArray(location['stage-last-value']) && location['stage-last-value'][0]?.['tsid'])
                    ? location['stage-last-value'][0]['tsid']
                    : null;

                const link = tsid
                    ? `https://wm.mvs.ds.usace.army.mil/apps/chart/index.html?&office=MVS&cwms_ts_id=${tsid}&cda=internal&lookback=4&lookforward=0`
                    : '#'; // Use a placeholder if tsid is missing

                const currentLevelCell = document.createElement('td');
                const linkElement = document.createElement('a');
                linkElement.href = link;
                linkElement.target = '_blank';

                const currentLevel = (location['stage-last-value'] && Array.isArray(location['stage-last-value']) && location['stage-last-value'][0]?.['value'])
                    ? location['stage-last-value'][0]['value']
                    : null;

                const floodValue = location['flood']?.['constant-value'] ?? null;
                const recordStage = location['record-stage'];
                const recordStageValue = recordStage ? recordStage['constant-value'] : null;

                // Set text content and styles based on flood and recordStage thresholds
                if (currentLevel != null) {
                    const formattedLevel = currentLevel.toFixed(2);
                    linkElement.textContent = formattedLevel;

                    if (recordStageValue !== null && currentLevel >= recordStageValue) {
                        linkElement.classList.add('record_breaking'); // Add "alert" class when currentLevel >= recordStageValue
                    }

                    if (floodValue != null && currentLevel >= floodValue) {
                        linkElement.style.color = 'red';  // Make text red if currentLevel exceeds floodValue
                    }

                } else {
                    linkElement.textContent = '';  // Display an empty string if currentLevel is null
                }

                currentLevelCell.appendChild(linkElement);
                row.appendChild(currentLevelCell);
            })();

            // 03 - 24hr Delta
            (() => {
                const deltaCell = document.createElement('td');

                // Check if 'stage-last-value' exists, is an array, and has at least one element with 'delta' property
                let deltaValue = (location['stage-last-value'] && Array.isArray(location['stage-last-value']) && location['stage-last-value'][0]?.['delta'] !== undefined)
                    ? location['stage-last-value'][0]['delta']
                    : "N/A";  // Default to "N/A" if 'delta' is not available

                // Format deltaValue to 2 decimal places if it's a number
                deltaCell.textContent = typeof deltaValue === 'number' ? deltaValue.toFixed(2) : deltaValue;
                row.appendChild(deltaCell);
            })();

            // 04 - Consr Storage
            (() => {
                const conservationStorageCell = document.createElement('td');
                const conservationStorageValue = "%";

                conservationStorageCell.textContent = conservationStorageValue;
                row.appendChild(conservationStorageCell);
            })();

            // 05 - Flood Storage
            (() => {
                const floodStorageCell = document.createElement('td');
                const floodStorageValue = "%";

                floodStorageCell.textContent = floodStorageValue;
                row.appendChild(floodStorageCell);
            })();

            // 06 - Precip
            (() => {
                const precipCell = document.createElement('td');

                // Check if 'precip-lake-last-value' exists, is an array, and has at least one element
                let precipValue = (location['precip-lake-last-value'] && Array.isArray(location['precip-lake-last-value']) && location['precip-lake-last-value'][0])
                    ? location['precip-lake-last-value'][0]['value']
                    : "N/A";  // Default to "N/A" if the value doesn't exist or is not an array

                // Ensure the value is a number before calling toFixed
                if (typeof precipValue === 'number') {
                    precipValue = precipValue.toFixed(2); // Format to 2 decimal places
                } else {
                    precipValue = "--";
                }

                precipCell.textContent = precipValue;
                row.appendChild(precipCell);
            })();

            // 07 - Yesterdays Inflow
            (() => {
                const yesterdaysInflowCell = document.createElement('td');

                // Check if 'inflow-yesterday-lake-last-value' exists and is an array, then get the first element
                let yesterdaysInflowValue = (location['inflow-yesterday-lake-last-value'] && Array.isArray(location['inflow-yesterday-lake-last-value']) && location['inflow-yesterday-lake-last-value'][0])
                    ? location['inflow-yesterday-lake-last-value'][0]['value']
                    : "N/A";  // Default to "N/A" if the value doesn't exist or is not an array

                // Ensure the value is a number before calling toFixed
                if (typeof yesterdaysInflowValue === 'number') {
                    yesterdaysInflowValue = yesterdaysInflowValue.toFixed(0); // Format as an integer
                } else {
                    yesterdaysInflowValue = "--";
                }

                yesterdaysInflowCell.textContent = yesterdaysInflowValue;
                row.appendChild(yesterdaysInflowCell);
            })();

            // 08 - Midnight - Controlled Outflow
            (() => {
                const midnightControlledOutflowCell = document.createElement('td');
                const midnightControlledOutflowValue = "--";

                midnightControlledOutflowCell.textContent = midnightControlledOutflowValue;
                row.appendChild(midnightControlledOutflowCell);
            })();

            // 09 - Evening - Controlled Outflow
            (() => {
                const eveningControlledOutflowCell = document.createElement('td');
                const eveningControlledOutflowValue = "--";

                eveningControlledOutflowCell.textContent = eveningControlledOutflowValue;
                row.appendChild(eveningControlledOutflowCell);
            })();

            // 10 - Seasonal Rule Curve
            (() => {
                const seasonalRuleCurveCell = document.createElement('td');
                const seasonalRuleCurveValue = "--";

                seasonalRuleCurveCell.textContent = seasonalRuleCurveValue;
                row.appendChild(seasonalRuleCurveCell);
            })();

            // 11 - Crest - Pool Forecast
            (() => {
                const crestPoolForecastCell = document.createElement('td');
                const crestPoolForecastValue = "--";

                crestPoolForecastCell.textContent = crestPoolForecastValue;
                row.appendChild(crestPoolForecastCell);
            })();

            // 12 - Date - Pool Forecast
            (() => {
                const datePoolForecastCell = document.createElement('td');
                const datePoolForecastValue = "--";

                datePoolForecastCell.textContent = datePoolForecastValue;
                row.appendChild(datePoolForecastCell);
            })();

            // 13 - Record Stage
            (() => {
                const recordStageCell = document.createElement('td');
                const recordStage = location['record-stage'];
                const recordStageValue = recordStage ? recordStage['constant-value'] : null;

                // Check if recordStageValue is valid and within the required range
                recordStageCell.textContent = recordStageValue != null && recordStageValue <= 900
                    ? recordStageValue.toFixed(2)
                    : '';

                row.appendChild(recordStageCell);
            })();

            // 14 - Record Date
            (() => {
                const recordDateCell = document.createElement('td');

                const recordDateValue = location['river-mile'] && location['river-mile']['record_stage_date_hard_coded'];
                recordDateCell.textContent = recordDateValue != null ? recordDateValue : "";
                // Set the title for the cell
                recordDateCell.title = "Hard Coded with Json File";
                // Set halo effect using text-shadow with orange color
                recordDateCell.style.textShadow = '0 0 2px rgba(255, 165, 0, 0.7), 0 0 2px rgba(255, 140, 0, 0.5)';

                row.appendChild(recordDateCell);
            })();

            table.appendChild(row);
        });
    });

    // Return the constructed table element
    return table;
}

function updateLocData(locData, type, data, lastValue, maxValue, minValue, cumValue, incValue, hourlyValue, day1NwsValue, day2NwsValue, day3NwsValue) {
    const keys = {
        apiDataKey: `${type}-api-data`,
        lastValueKey: `${type}-last-value`,
        maxValueKey: `${type}-max-value`,
        minValueKey: `${type}-min-value`,
        cumValueKey: `${type}-cum-value`,
        incValueKey: `${type}-inc-value`,
        hourlyValueKey: `${type}-hourly-value`,
        day1NwsValueKey: `${type}-day1-nws-value`,
        day2NwsValueKey: `${type}-day2-nws-value`,
        day3NwsValueKey: `${type}-day3-nws-value`
    };

    for (let [key, value] of Object.entries(keys)) {
        if (!locData[value]) {
            locData[value] = [];
        }

        switch (key) {
            case 'apiDataKey':
                locData[value].push(data);
                break;
            case 'lastValueKey':
                locData[value].push(lastValue);
                break;
            case 'maxValueKey':
                locData[value].push(maxValue);
                break;
            case 'minValueKey':
                locData[value].push(minValue);
                break;
            case 'cumValueKey':
                locData[value].push(cumValue);
                break;
            case 'incValueKey':
                locData[value].push(incValue);
                break;
            case 'hourlyValueKey':
                locData[value].push(hourlyValue);
                break;
            case 'day1NwsValueKey':
                locData[value].push(day1NwsValue);
                break;
            case 'day2NwsValueKey':
                locData[value].push(day2NwsValue);
                break;
            case 'day3NwsValueKey':
                locData[value].push(day3NwsValue);
                break;
            default:
                console.error('Unknown key:', key);
        }
    }
}

// ******************************************************
// ******* Hard Coded Nws Forecast Time *****************
// ******************************************************

// Function to fetch exportNwsForecasts2Json.json
async function fetchDataFromNwsForecastsOutput() {
    let urlNwsForecast = null;
    urlNwsForecast = 'https://wm.mvs.ds.usace.army.mil//php_data_api/public/json/exportNwsForecasts2Json.json';

    // console.log("urlNwsForecast: ", urlNwsForecast);

    try {
        const response = await fetch(urlNwsForecast);
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error fetching data:', error);
        throw error; // Propagate the error further if needed
    }
}

// Function to filter ROutput data by tsid_stage_nws_3_day_forecast
function filterDataByTsid(NwsOutput, cwms_ts_id) {
    const filteredData = NwsOutput.filter(item => {
        return item !== null && item.cwms_ts_id_day1 === cwms_ts_id;
    });

    return filteredData;
}

// Function to fetch and log NwsOutput data
async function fetchAndLogNwsData(tsid_stage_nws_3_day_forecast, forecastTimeCell) {
    try {
        const NwsOutput = await fetchDataFromNwsForecastsOutput();
        // console.log('NwsOutput:', NwsOutput);

        const filteredData = filterDataByTsid(NwsOutput, tsid_stage_nws_3_day_forecast);
        // console.log("Filtered NwsOutput Data for", tsid_stage_nws_3_day_forecast + ":", filteredData);

        // Update the HTML element with filtered data
        updateNwsForecastTimeHTML(filteredData, forecastTimeCell);

        // Further processing of ROutput data as needed
    } catch (error) {
        // Handle errors from fetchDataFromROutput
        console.error('Failed to fetch data:', error);
    }
}

// Function to update the HTML element with filtered data
function updateNwsForecastTimeHTML(filteredData, forecastTimeCell) {
    const locationData = filteredData.find(item => item !== null); // Find the first non-null item
    if (!locationData) {
        forecastTimeCell.innerHTML = ''; // Handle case where no valid data is found
        return;
    }

    const entryDate = locationData.data_entry_date_cst1;

    // Parse the entry date string
    const dateParts = entryDate.split('-'); // Split by hyphen
    const day = dateParts[0]; // Day part
    const monthAbbreviation = dateParts[1]; // Month abbreviation (e.g., JUL)
    const year = dateParts[2].substring(0, 2); // Last two digits of the year (e.g., 24)

    // Map month abbreviation to month number
    const months = {
        'JAN': '01', 'FEB': '02', 'MAR': '03', 'APR': '04',
        'MAY': '05', 'JUN': '06', 'JUL': '07', 'AUG': '08',
        'SEP': '09', 'OCT': '10', 'NOV': '11', 'DEC': '12'
    };

    const month = months[monthAbbreviation]; // Get numeric month

    // Parse time parts
    const timeParts = entryDate.split(' ')[1].split('.'); // Split time part by period
    const hours = timeParts[0]; // Hours part
    const minutes = timeParts[1]; // Minutes part

    // Determine period (AM/PM)
    const period = timeParts[3] === 'PM' ? 'PM' : 'AM';

    // Construct formatted date and time
    const formattedDateTime = `${month}-${day}-${year} ${hours}:${minutes} ${period}`;

    // Update the HTML content
    forecastTimeCell.innerHTML = `<div class="hard_coded_php" title="Uses PHP exportNwsForecasts2Json.json Output, No Cloud Option Yet">${formattedDateTime}</div>`;
}