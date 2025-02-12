document.addEventListener('DOMContentLoaded', async function () {
    console.log("This is dev");

    let setReportDiv = null;
    setReportDiv = "river_reservoir";

    const loadingIndicator = document.getElementById(`loading_${setReportDiv}`);
    loadingIndicator.style.display = 'block';

    let setBaseUrl = null;
    if (cda === "internal") {
        setBaseUrl = `https://wm.${office.toLowerCase()}.ds.usace.army.mil:8243/${office.toLowerCase()}-data/`;
    } else if (cda === "internal-coop") {
        setBaseUrl = `https://wm-${office.toLowerCase()}coop.mvk.ds.usace.army.mil:8243/${office.toLowerCase()}-data/`;
    } else if (cda === "public") {
        setBaseUrl = `https://cwms-data.usace.army.mil/cwms-data/`;
    }
    console.log("setBaseUrl: ", setBaseUrl);

    const lakeLocs = [
        "Lk Shelbyville-Kaskaskia",
        "Carlyle Lk-Kaskaskia",
        "Rend Lk-Big Muddy",
        "Wappapello Lk-St Francis",
        "Mark Twain Lk-Salt"
    ];

    if (json === "true") {
        fetch(`json/gage_control.json`)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok');
                }
                return response.json();
            })
            .then(combinedData => {
                console.log('combinedData:', combinedData);

                const formatDate = (daysToAdd) => {
                    const date = new Date();
                    date.setDate(date.getDate() + daysToAdd);
                    return ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
                };

                const [day1, day2, day3] = [1, 2, 3].map(days => formatDate(days));
                const combinedDataRiver = structuredClone ? structuredClone(combinedData) : JSON.parse(JSON.stringify(combinedData));
                const combinedDataReservoir = structuredClone ? structuredClone(combinedData) : JSON.parse(JSON.stringify(combinedData));

                console.log('combinedDataRiver:', combinedDataRiver);
                console.log('combinedDataReservoir:', combinedDataReservoir);

                const tableRiver = createTableRiver(combinedDataRiver, type, day1, day2, day3, setBaseUrl);
                const tableReservoir = createTableReservoir(combinedDataReservoir, type, day1, day2, day3, lakeLocs, setBaseUrl);

                document.getElementById(`table_container_${setReportDiv}`).append(tableRiver, tableReservoir);
                // document.getElementById(`table_container_${setReportDiv}`).append(tableRiver);

                loadingIndicator.style.display = 'none';
            })
            .catch(error => {
                console.error('Error fetching data:', error);
            });
    } else {
        let setLocationCategory = null;
        let setLocationGroupOwner = null;
        let setTimeseriesGroup1 = null;
        let setTimeseriesGroup2 = null;
        let setTimeseriesGroup3 = null;
        let setTimeseriesGroup4 = null;
        let setTimeseriesGroup5 = null;
        let setTimeseriesGroup6 = null;
        let setLookBack = null;
        let setLookForward = null;

        setLocationCategory = "Basins";
        setLocationGroupOwner = "River-Reservoir";
        setTimeseriesGroup1 = "Stage";
        setTimeseriesGroup2 = "Forecast-NWS";
        setTimeseriesGroup3 = "Crest";
        setTimeseriesGroup4 = "Precip-Lake";
        setTimeseriesGroup5 = "Inflow-Yesterday-Lake";
        setTimeseriesGroup6 = "Storage";
        setLookBack = subtractDaysFromDate(new Date(), 2);
        setLookForward = addDaysFromDate(new Date(), 14);

        const categoryApiUrl = `${setBaseUrl}location/group?office=${office}&include-assigned=false&location-category-like=${setLocationCategory}`;

        // Initialize Maps to hold datasets
        const metadataMap = new Map();
        const recordStageMap = new Map();
        const lwrpMap = new Map();
        const floodMap = new Map();
        const stageTsidMap = new Map();
        const riverMileMap = new Map();
        const riverMileHardCodedMap = new Map();
        const forecastNwsTsidMap = new Map();
        const crestNwsTsidMap = new Map();
        const precipLakeTsidMap = new Map();
        const inflowYesterdayLakeTsidMap = new Map();
        const storageLakeTsidMap = new Map();
        const topOfFloodMap = new Map();
        const topOfConservationMap = new Map();
        const bottomOfFloodMap = new Map();
        const bottomOfConservationMap = new Map();

        // Fetch data functions with promise arrays for async processing
        const metadataPromises = [];
        const recordStageTsidPromises = [];
        const lwrpPromises = [];
        const floodPromises = [];
        const stageTsidPromises = [];
        const riverMilePromises = [];
        const riverMileHardCodedPromises = [];
        const forecastNwsTsidPromises = [];
        const crestTsidPromises = [];
        const precipLakeTsidPromises = [];
        const inflowYesterdayLakeTsidPromises = [];
        const storageLakeTsidPromises = [];
        const topOfFloodPromises = [];
        const topOfConservationPromises = [];
        const bottomOfFloodPromises = [];
        const bottomOfConservationPromises = [];
        const apiPromises = [];

        let combinedData = [];

        // Initial category fetch
        fetch(categoryApiUrl)
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                if (!Array.isArray(data) || data.length === 0) {
                    console.warn('No data available from the initial fetch.');
                    return;
                }

                // Filter data where category is "Basins"
                const targetCategory = { "office-id": office, "id": setLocationCategory };
                const filteredArray = filterByLocationCategory(data, targetCategory);
                let basins = filteredArray.map(item => item.id);
                if (basins.length === 0) {
                    console.warn('No basins found for the given category.');
                    return;
                }

                // Loop through each basin and get all the assigned locations
                basins.forEach(basin => {
                    const basinApiUrl = `${setBaseUrl}location/group/${basin}?office=${office}&category-id=${setLocationCategory}`;
                    apiPromises.push(
                        fetch(basinApiUrl)
                            .then(response => {
                                if (!response.ok) throw new Error(`Network response was not ok for basin ${basin}`);
                                return response.json();
                            })
                            .then(getBasin => {
                                // console.log("getBasin: ", getBasin);

                                if (getBasin) {
                                    // Fetch additional data needed for filtering
                                    const additionalDataPromises = getBasin['assigned-locations'].map(location => {
                                        return fetchAdditionalLocationGroupOwnerData(location[`location-id`], setBaseUrl, setLocationGroupOwner, office);
                                    });

                                    // console.log("additionalDataPromises: ", additionalDataPromises);

                                    // Wait for all promises to resolve
                                    Promise.all(additionalDataPromises)
                                        .then(results => {
                                            results = results[0];
                                            // console.log("results: ", results);

                                            // Loop through getBasin['assigned-locations'] and compare with results
                                            getBasin['assigned-locations'] = getBasin['assigned-locations'].filter(location => {
                                                let matchedData;
                                                // Check if 'assigned-locations' exists in the results object
                                                if (results && results['assigned-locations']) {
                                                    for (const loc of results['assigned-locations']) {
                                                        // console.log('Comparing:', loc['location-id'], 'with', location['location-id']);
                                                        if (loc['location-id'] === location['location-id']) {
                                                            matchedData = results;
                                                            break;
                                                        }
                                                    }
                                                }
                                                // console.log("matchedData: ", matchedData);

                                                if (matchedData) {
                                                    // If matchedData exists and contains a location with the same location-id, keep the location
                                                    return true;
                                                } else {
                                                    // Log the location that has been removed
                                                    console.log("Removed location: ", location);
                                                    return false;  // Remove location if there is no match
                                                }
                                            });

                                            // Filter locations with attribute <= 900
                                            getBasin['assigned-locations'] = getBasin['assigned-locations'].filter(location => location.attribute <= 900);

                                            // Sort the locations by their attribute
                                            getBasin['assigned-locations'].sort((a, b) => a.attribute - b.attribute);

                                            // Push the updated basin data to combinedData
                                            combinedData.push(getBasin);
                                        })
                                        .catch(error => {
                                            console.error('Error in fetching additional data:', error);
                                        });

                                    getBasin['assigned-locations'].forEach(loc => {
                                        fetchAndStoreDataForLocation(loc);
                                    });
                                }
                            })
                            .catch(error => console.error(`Problem with the fetch operation for basin ${basin}:`, error))
                    );
                });

                // Fetch data for each location's attributes
                function fetchAndStoreDataForLocation(loc) {
                    // Fetch location levels
                    (() => {
                        const metadataApiUrl = `${setBaseUrl}locations/${loc['location-id']}?office=${office}`;
                        metadataPromises.push(fetch(metadataApiUrl)
                            .then(response => response.ok ? response.json() : null)
                            .then(data => data && metadataMap.set(loc['location-id'], data))
                            .catch(error => console.error(`Error fetching metadata for ${loc['location-id']}:`, error))
                        );

                        const recordStageLevelId = `${loc['location-id']}.Stage.Inst.0.Record Stage`;
                        const levelIdEffectiveDate = "2024-01-01T08:00:00";
                        const recordStageApiUrl = `${setBaseUrl}levels/${recordStageLevelId}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ft`;
                        recordStageTsidPromises.push(
                            fetch(recordStageApiUrl)
                                .then(response => response.status === 404 ? null : response.ok ? response.json() : Promise.reject(`Network response was not ok: ${response.statusText}`))
                                .then(recordStageData => {
                                    // Set map to null if the data is null or undefined
                                    recordStageMap.set(loc['location-id'], recordStageData != null ? recordStageData : null);
                                })
                                .catch(error => console.error(`Error fetching record stage for ${loc['location-id']}:`, error))
                        );

                        // For Rivers only
                        if (!lakeLocs.includes(loc['location-id'])) {
                            const riverMileApiUrl = `${setBaseUrl}stream-locations?office-mask=${office}&name-mask=${loc['location-id']}`;
                            riverMilePromises.push(fetch(riverMileApiUrl)
                                .then(response => response.ok ? response.json() : null)
                                .then(data => data && riverMileMap.set(loc['location-id'], data))
                                .catch(error => console.error(`Error fetching river mile for ${loc['location-id']}:`, error))
                            );

                            riverMileHardCodedPromises.push(
                                fetch('json/gage_control_official.json')
                                    .then(response => {
                                        if (!response.ok) {
                                            throw new Error(`Network response was not ok: ${response.statusText}`);
                                        }
                                        return response.json();
                                    })
                                    .then(riverMilesJson => {
                                        for (const basin in riverMilesJson) {
                                            const locations = riverMilesJson[basin];
                                            for (const locId in locations) {
                                                const ownerData = locations[locId];
                                                const riverMile = ownerData.river_mile_hard_coded;
                                                const outputData = {
                                                    locationId: locId,
                                                    basin: basin,
                                                    riverMile: riverMile
                                                };
                                                riverMileHardCodedMap.set(locId, ownerData);
                                            }
                                        }
                                    })
                                    .catch(error => console.error('Problem with the fetch operation:', error))
                            );

                            const levelIdLwrp = `${loc['location-id']}.Stage.Inst.0.LWRP`;
                            const lwrpApiUrl = `${setBaseUrl}levels/${levelIdLwrp}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ft`;
                            lwrpPromises.push(
                                fetch(lwrpApiUrl)
                                    .then(response => response.status === 404 ? null : response.ok ? response.json() : Promise.reject(`Network response was not ok: ${response.statusText}`))
                                    .then(lwrpData => {
                                        // Set map to null if the data is null or undefined
                                        lwrpMap.set(loc['location-id'], lwrpData != null ? lwrpData : null);
                                    })
                                    .catch(error => console.error(`Error fetching lwrp level for ${loc['location-id']}:`, error))
                            );

                            const levelIdFlood = `${loc['location-id']}.Stage.Inst.0.Flood`;
                            const floodApiUrl = `${setBaseUrl}levels/${levelIdFlood}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ft`;
                            floodPromises.push(
                                fetch(floodApiUrl)
                                    .then(response => response.status === 404 ? null : response.ok ? response.json() : Promise.reject(`Network response was not ok: ${response.statusText}`))
                                    .then(floodData => {
                                        // Set map to null if the data is null or undefined
                                        floodMap.set(loc['location-id'], floodData != null ? floodData : null);
                                    })
                                    .catch(error => console.error(`Error fetching flood level for ${loc['location-id']}:`, error))
                            );

                        }

                        // For Lakes only
                        if (lakeLocs.includes(loc['location-id'])) {
                            const levelIdTopOfFlood = `${loc['location-id'].split('-')[0]}.Stor.Inst.0.Top of Flood`;
                            const topOfFloodApiUrl = `${setBaseUrl}levels/${levelIdTopOfFlood}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ac-ft`;
                            topOfFloodPromises.push(
                                fetch(topOfFloodApiUrl)
                                    .then(response => response.status === 404 ? null : response.ok ? response.json() : Promise.reject(`Network response was not ok: ${response.statusText}`))
                                    .then(topOfFloodData => {
                                        // Set map to null if the data is null or undefined
                                        topOfFloodMap.set(loc['location-id'], topOfFloodData != null ? topOfFloodData : null);
                                    })
                                    .catch(error => console.error(`Error fetching top of flood level for ${loc['location-id']}:`, error))
                            );

                            const levelIdBottomOfFlood = `${loc['location-id'].split('-')[0]}.Stor.Inst.0.Bottom of Flood`;
                            const bottomOfFloodApiUrl = `${setBaseUrl}levels/${levelIdBottomOfFlood}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ac-ft`;
                            bottomOfFloodPromises.push(
                                fetch(bottomOfFloodApiUrl)
                                    .then(response => response.status === 404 ? null : response.ok ? response.json() : Promise.reject(`Network response was not ok: ${response.statusText}`))
                                    .then(bottomOfFloodData => {
                                        // Set map to null if the data is null or undefined
                                        bottomOfFloodMap.set(loc['location-id'], bottomOfFloodData != null ? bottomOfFloodData : null);
                                    })
                                    .catch(error => console.error(`Error fetching bottom of flood level for ${loc['location-id']}:`, error))
                            );

                            const levelIdTopOfConservation = `${loc['location-id'].split('-')[0]}.Stor.Inst.0.Top of Conservation`;
                            const topOfConservationApiUrl = `${setBaseUrl}levels/${levelIdTopOfConservation}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ac-ft`;
                            topOfConservationPromises.push(
                                fetch(topOfConservationApiUrl)
                                    .then(response => response.status === 404 ? null : response.ok ? response.json() : Promise.reject(`Network response was not ok: ${response.statusText}`))
                                    .then(topOfConservationData => {
                                        // Set map to null if the data is null or undefined
                                        topOfConservationMap.set(loc['location-id'], topOfConservationData != null ? topOfConservationData : null);
                                    })
                                    .catch(error => console.error(`Error fetching top of conservation level for ${loc['location-id']}:`, error))
                            );

                            const levelIdBottomOfConservation = `${loc['location-id'].split('-')[0]}.Stor.Inst.0.Bottom of Conservation`;
                            const bottomOfConservationApiUrl = `${setBaseUrl}levels/${levelIdBottomOfConservation}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ac-ft`;
                            bottomOfConservationPromises.push(
                                fetch(bottomOfConservationApiUrl)
                                    .then(response => response.status === 404 ? null : response.ok ? response.json() : Promise.reject(`Network response was not ok: ${response.statusText}`))
                                    .then(bottomOfConservationData => {
                                        // Set map to null if the data is null or undefined
                                        bottomOfConservationMap.set(loc['location-id'], bottomOfConservationData != null ? bottomOfConservationData : null);
                                    })
                                    .catch(error => console.error(`Error fetching bottom of conservation level for ${loc['location-id']}:`, error))
                            );
                        }
                    })();

                    // Fetch tsids
                    (() => {
                        const stageApiUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup1}?office=${office}&category-id=${loc['location-id']}`;
                        stageTsidPromises.push(fetch(stageApiUrl)
                            .then(response => response.ok ? response.json() : null)
                            .then(data => data && stageTsidMap.set(loc['location-id'], data))
                            .catch(error => console.error(`Error fetching stage TSID for ${loc['location-id']}:`, error))
                        );

                        // For Rivers only
                        if (!lakeLocs.includes(loc['location-id'])) {
                            const forecastNwsApiUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup2}?office=${office}&category-id=${loc['location-id']}`;
                            forecastNwsTsidPromises.push(fetch(forecastNwsApiUrl)
                                .then(response => response.ok ? response.json() : null)
                                .then(data => data && forecastNwsTsidMap.set(loc['location-id'], data))
                                .catch(error => console.error(`Error fetching forecast NWS TSID for ${loc['location-id']}:`, error))
                            );

                            const crestApiUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup3}?office=${office}&category-id=${loc['location-id']}`;
                            crestTsidPromises.push(fetch(crestApiUrl)
                                .then(response => response.ok ? response.json() : null)
                                .then(data => data && crestNwsTsidMap.set(loc['location-id'], data))
                                .catch(error => console.error(`Error fetching crest TSID for ${loc['location-id']}:`, error))
                            );
                        }

                        // For Lakes only
                        if (lakeLocs.includes(loc['location-id'])) {
                            const precipLakeApiUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup4}?office=${office}&category-id=${loc['location-id']}`;
                            precipLakeTsidPromises.push(
                                fetch(precipLakeApiUrl)
                                    .then(response => response.status === 404 ? null : response.ok ? response.json() : Promise.reject(`Network response was not ok: ${response.statusText}`))
                                    .then(data => data && precipLakeTsidMap.set(loc['location-id'], data))
                                    .catch(error => console.error(`Error fetching precipLake TSID for ${loc['location-id']}:`, error))
                            );

                            const inflowYesterdayLakeApiUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup5}?office=${office}&category-id=${loc['location-id']}`;
                            inflowYesterdayLakeTsidPromises.push(
                                fetch(inflowYesterdayLakeApiUrl)
                                    .then(response => response.status === 404 ? null : response.ok ? response.json() : Promise.reject(`Network response was not ok: ${response.statusText}`))
                                    .then(data => data && inflowYesterdayLakeTsidMap.set(loc['location-id'], data))
                                    .catch(error => console.error(`Error fetching inflowYesterdayLake TSID for ${loc['location-id']}:`, error))
                            );

                            const storageLakeApiUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup6}?office=${office}&category-id=${loc['location-id']}`;
                            storageLakeTsidPromises.push(
                                fetch(storageLakeApiUrl)
                                    .then(response => response.status === 404 ? null : response.ok ? response.json() : Promise.reject(`Network response was not ok: ${response.statusText}`))
                                    .then(data => data && storageLakeTsidMap.set(loc['location-id'], data))
                                    .catch(error => console.error(`Error fetching storageLake TSID for ${loc['location-id']}:`, error))
                            );
                        }
                    })();
                }

                // Resolve all initial fetches before processing
                Promise.all(apiPromises)
                    .then(() => Promise.all([
                        ...metadataPromises,
                        ...recordStageTsidPromises,
                        ...lwrpPromises,
                        ...floodPromises,
                        ...topOfFloodPromises,
                        ...topOfConservationPromises,
                        ...bottomOfFloodPromises,
                        ...bottomOfConservationPromises,
                        ...riverMilePromises,
                        ...riverMileHardCodedPromises,
                        ...stageTsidPromises,
                        ...forecastNwsTsidPromises,
                        ...crestTsidPromises,
                        ...precipLakeTsidPromises,
                        ...inflowYesterdayLakeTsidPromises,
                        ...storageLakeTsidPromises]))
                    .then(() => {
                        // Process data to add to each location and display combinedData
                        combinedData.forEach(basinData => {
                            if (basinData['assigned-locations']) {
                                basinData['assigned-locations'].forEach(loc => {
                                    loc['metadata'] = metadataMap.get(loc['location-id']);
                                    loc['record-stage'] = recordStageMap.get(loc['location-id']);
                                    loc['lwrp'] = lwrpMap.get(loc['location-id']);
                                    loc['flood'] = floodMap.get(loc['location-id']);
                                    loc['top-of-flood'] = topOfFloodMap.get(loc['location-id']);
                                    loc['top-of-conservation'] = topOfConservationMap.get(loc['location-id']);
                                    loc['bottom-of-flood'] = bottomOfFloodMap.get(loc['location-id']);
                                    loc['bottom-of-conservation'] = bottomOfConservationMap.get(loc['location-id']);
                                    loc['river-mile'] = riverMileMap.get(loc['location-id']);
                                    loc['river-mile-hard-coded'] = riverMileHardCodedMap.get(loc['location-id']);
                                    loc['tsid-stage'] = stageTsidMap.get(loc['location-id']);
                                    loc['tsid-nws-forecast'] = forecastNwsTsidMap.get(loc['location-id']);
                                    loc['tsid-nws-crest'] = crestNwsTsidMap.get(loc['location-id']);
                                    loc['tsid-lake-precip'] = precipLakeTsidMap.get(loc['location-id']);
                                    loc['tsid-lake-inflow-yesterday'] = inflowYesterdayLakeTsidMap.get(loc['location-id']);
                                    loc['tsid-lake-storage'] = storageLakeTsidMap.get(loc['location-id']);
                                });
                            }
                        });

                        console.log('All combined data fetched successfully:', combinedData);

                        // Filter data
                        (() => {
                            // Step 1: Remove locations where 'attribute' ends with '.1'
                            combinedData.forEach(dataObj => {
                                dataObj['assigned-locations'] = dataObj['assigned-locations'].filter(location => !location['attribute'].toString().endsWith('.1'));
                            });
                            console.log('Filtered locations with attribute ending in .1:', combinedData);

                            // Step 3: Remove locations where 'tsid-stage' is null
                            combinedData.forEach(dataGroup => {
                                dataGroup['assigned-locations'] = dataGroup['assigned-locations'].filter(location => location['tsid-stage'] != null);
                            });
                            console.log('Filtered locations with null tsid-stage:', combinedData);

                            // Step 4: Remove basins with no 'assigned-locations'
                            combinedData = combinedData.filter(item => item['assigned-locations']?.length > 0);
                            console.log('Filtered empty basins:', combinedData);

                            // Step 5: Sort basins by predefined order
                            const sortOrderBasin = ['Mississippi', 'Illinois', 'Cuivre', 'Missouri', 'Meramec', 'Ohio', 'Kaskaskia', 'Big Muddy', 'St Francis', 'Salt'];
                            combinedData.sort((a, b) => {
                                const indexA = sortOrderBasin.indexOf(a.id);
                                const indexB = sortOrderBasin.indexOf(b.id);
                                return (indexA === -1 ? 1 : indexA) - (indexB === -1 ? 1 : indexB);
                            });
                            console.log('Sorted basins:', combinedData);
                        })();
                    })
                    .then(() => {
                        console.log('All combinedData fetched and filtered successfully:', combinedData);

                        const formatDate = (daysToAdd) => {
                            const date = new Date();
                            date.setDate(date.getDate() + daysToAdd);
                            return ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
                        };

                        const [day1, day2, day3] = [1, 2, 3].map(days => formatDate(days));
                        const combinedDataRiver = structuredClone ? structuredClone(combinedData) : JSON.parse(JSON.stringify(combinedData));
                        const combinedDataReservoir = structuredClone ? structuredClone(combinedData) : JSON.parse(JSON.stringify(combinedData));

                        console.log('combinedDataRiver:', combinedDataRiver);
                        console.log('combinedDataReservoir:', combinedDataReservoir);

                        const tableRiver = createTableRiver(combinedDataRiver, type, day1, day2, day3, setBaseUrl);
                        const tableReservoir = createTableReservoir(combinedDataReservoir, type, day1, day2, day3, lakeLocs, setBaseUrl);

                        document.getElementById(`table_container_${setReportDiv}`).append(tableRiver, tableReservoir);

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
    }
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

function createTablePrecip(combinedData, type) {
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
            const riverMileValue = location['river-mile-hard-coded'] && location['river-mile-hard-coded']['river_mile_hard_coded'];
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

function createTableRiver(combinedDataRiver, type, nws_day1_date_title, nws_day2_date_title, nws_day3_date_title, setBaseUrl) {
    // Create a table element and set an ID for styling or selection purposes
    const table = document.createElement('table');
    table.setAttribute('id', 'webrep');

    // Get current date and time
    const currentDateTime = new Date();
    // console.log('currentDateTime:', currentDateTime);

    // Subtract two hours from current date and time
    const currentDateTimeMinus2Hours = subtractHoursFromDate(currentDateTime, 2);
    // console.log('currentDateTimeMinus2Hours :', currentDateTimeMinus2Hours);

    // Subtract two hours from current date and time
    const currentDateTimeMinus8Hours = subtractHoursFromDate(currentDateTime, 8);
    // console.log('currentDateTimeMinus8Hours :', currentDateTimeMinus8Hours);

    // Subtract thirty hours from current date and time
    const currentDateTimeMinus30Hours = subtractHoursFromDate(currentDateTime, 64);
    // console.log('currentDateTimeMinus30Hours :', currentDateTimeMinus30Hours);

    // Add thirty hours to current date and time
    const currentDateTimePlus30Hours = plusHoursFromDate(currentDateTime, 30);
    // console.log('currentDateTimePlus30Hours :', currentDateTimePlus30Hours);

    // Add four days to current date and time
    const currentDateTimePlus4Days = addDaysToDate(currentDateTime, 4);
    // console.log('currentDateTimePlus4Days :', currentDateTimePlus4Days);
    // console.log('currentDateTimePlus4Days :', typeof(currentDateTimePlus4Days));

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
        basinCell.style.textAlign = 'left';
        basinCell.style.paddingLeft = '10px';
        basinCell.style.backgroundColor = 'darkblue';
        basinRow.appendChild(basinCell);
        table.appendChild(basinRow);

        basin['assigned-locations'].forEach((location) => {
            const row = document.createElement('tr');

            // 01 - River Mile
            (() => {
                const riverMileCell = document.createElement('td');

                // use hard coded river mile
                (() => {
                    // const riverMileValue = location['river-mile-hard-coded'] && location['river-mile-hard-coded']['river_mile_hard_coded'];
                    // riverMileCell.textContent = riverMileValue != null ? parseFloat(riverMileValue).toFixed(1) : "N/A";
                    // riverMileCell.title = "Hard Coded with Json File";
                    // riverMileCell.style.textShadow = '0 0 2px rgba(255, 165, 0, 0.7), 0 0 2px rgba(255, 140, 0, 0.5)';
                })();

                // use hard coded river mile
                (() => {
                    const locationId = location['location-id'];
                    const riverMileObject = location['river-mile'];
                    const riverMileValue = getStationForLocation(locationId, riverMileObject);
                    // console.log(`Station for location ${locationId}: ${riverMileValue}`);
                    riverMileCell.textContent = riverMileValue != null ? parseFloat(riverMileValue).toFixed(1) : "N/A";
                })();


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

            // 03 and 04 - Stage and Delta
            (() => {
                const stageTd = document.createElement('td');
                const deltaTd = document.createElement('td');

                const floodValue = location['flood'] ? location['flood']['constant-value'] : null;
                const stageTsid = location?.['tsid-stage']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (stageTsid) {
                    fetchAndUpdateStageTd(stageTd, deltaTd, stageTsid, floodValue, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl);
                }

                row.appendChild(stageTd);
                row.appendChild(deltaTd);
            })();

            // 05, 06 and 07 and 08 - Day1, Day2 and Day3 and Forecast Time
            (() => {
                const nwsDay1Td = document.createElement('td');
                const nwsDay2Td = document.createElement('td');
                const nwsDay3Td = document.createElement('td');

                const stageTsid = location?.['tsid-stage']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;
                const nwsForecastTsid = location?.['tsid-nws-forecast']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;
                const floodValue = location['flood'] ? location['flood']['constant-value'] : null;

                if (nwsForecastTsid) {
                    fetchAndUpdateNwsForecastTd(stageTsid, nwsForecastTsid, floodValue, currentDateTime, currentDateTimePlus4Days, setBaseUrl)
                        .then(({ nwsDay1Td: val1, nwsDay2Td: val2, nwsDay3Td: val3 }) => {
                            nwsDay1Td.textContent = val1;
                            nwsDay2Td.textContent = val2;
                            nwsDay3Td.textContent = val3;
                        })
                        .catch(error => console.error("Failed to fetch NWS data:", error));
                }

                row.appendChild(nwsDay1Td);
                row.appendChild(nwsDay2Td);
                row.appendChild(nwsDay3Td);
            })();

            // 08 - Nws Forecast Time PHP
            (() => {
                const nwsForecastTimeTd = document.createElement('td');
                const nwsForecastTsid = location['tsid-nws-forecast']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (nwsForecastTsid !== null) {
                    fetchAndLogNwsData(nwsForecastTsid, nwsForecastTimeTd);
                } else {
                    nwsForecastTimeTd.textContent = '';
                }

                row.appendChild(nwsForecastTimeTd);
            })();

            // 09 and 10 - Crest Value and Date Time
            (() => {
                const crestTd = document.createElement('td');
                const crestDateTd = document.createElement('td');

                const floodValue = location['flood'] ? location['flood']['constant-value'] : null;
                const crestTsid = location?.['tsid-nws-crest']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (crestTsid) {
                    fetchAndUpdateCrestTd(crestTd, crestDateTd, crestTsid, floodValue, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl);
                }

                row.appendChild(crestTd);
                row.appendChild(crestDateTd);
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
                    recordStageCell.textContent = '';  // Show 'N/A' if no valid recordStageValue
                }

                row.appendChild(recordStageCell);
            })();

            // 14 - Record Date
            (() => {
                const recordDateCell = document.createElement('td');

                // Retrieve the record stage date value, or use null if not available
                const recordDateValue = location['river-mile-hard-coded'] && location['river-mile-hard-coded']['record_stage_date_hard_coded'];

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

function createTableReservoir(combinedDataReservoir, type, nws_day1_date_title, nws_day2_date_title, nws_day3_date_title, lakeLocs, setBaseUrl) {
    // Create a table element
    const table = document.createElement('table');
    table.setAttribute('id', 'webreplake');

    console.log("lakeLocs: ", lakeLocs);
    console.log("combinedDataReservoir (before): ", combinedDataReservoir);

    // Get current date and time
    const currentDateTime = new Date();
    // console.log('currentDateTime:', currentDateTime);

    // Subtract two hours from current date and time
    const currentDateTimeMinus2Hours = subtractHoursFromDate(currentDateTime, 2);
    // console.log('currentDateTimeMinus2Hours :', currentDateTimeMinus2Hours);

    // Subtract two hours from current date and time
    const currentDateTimeMinus8Hours = subtractHoursFromDate(currentDateTime, 8);
    // console.log('currentDateTimeMinus8Hours :', currentDateTimeMinus8Hours);

    // Subtract thirty hours from current date and time
    const currentDateTimeMinus30Hours = subtractHoursFromDate(currentDateTime, 64);
    // console.log('currentDateTimeMinus30Hours :', currentDateTimeMinus30Hours);

    // Add thirty hours to current date and time
    const currentDateTimePlus30Hours = plusHoursFromDate(currentDateTime, 30);
    // console.log('currentDateTimePlus30Hours :', currentDateTimePlus30Hours);

    // Add four days to current date and time
    const currentDateTimePlus4Days = addDaysToDate(currentDateTime, 4);
    // console.log('currentDateTimePlus4Days :', currentDateTimePlus4Days);
    // console.log('currentDateTimePlus4Days :', typeof(currentDateTimePlus4Days));

    // Filter out locations not in lakeLocs, and remove basins without assigned-locations
    combinedDataReservoir = combinedDataReservoir.filter((basin) => {
        // Filter 'assigned-locations' within each basin
        basin['assigned-locations'] = basin['assigned-locations'].filter((location) => {
            const currentLocationId = location['location-id'];

            // Keep location only if it is found in lakeLocs
            return lakeLocs.includes(currentLocationId);
        });

        // Remove the basin if it has no assigned locations left
        return basin['assigned-locations'].length > 0;
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
            th.style.backgroundColor = 'darkblue';
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
                thStorageConsr.style.backgroundColor = 'darkblue';
                headerRowLake2.appendChild(thStorageConsr);

                const thStorageFlood = document.createElement('th');
                thStorageFlood.textContent = "Flood";
                thStorageFlood.style.backgroundColor = 'darkblue';
                headerRowLake2.appendChild(thStorageFlood);
            }
            if (columnName === "Controlled Outflow") {
                const thMidnightOutflow = document.createElement('th');
                thMidnightOutflow.textContent = "Midnight";
                thMidnightOutflow.style.backgroundColor = 'darkblue';
                headerRowLake2.appendChild(thMidnightOutflow);

                const thEveningOutflow = document.createElement('th');
                thEveningOutflow.textContent = "Evening";
                thEveningOutflow.style.backgroundColor = 'darkblue';
                headerRowLake2.appendChild(thEveningOutflow);
            }
            if (columnName === "Pool Forecast") {
                const thForecastCrest = document.createElement('th');
                thForecastCrest.textContent = "Crest";
                thForecastCrest.style.backgroundColor = 'darkblue';
                headerRowLake2.appendChild(thForecastCrest);

                const thForecastDate = document.createElement('th');
                thForecastDate.textContent = "Date";
                thForecastDate.style.backgroundColor = 'darkblue';
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
                const lakeTd = document.createElement('td');
                const lakeValue = location['location-id'].split('-')[0];
                lakeTd.textContent = lakeValue;
                row.appendChild(lakeTd);
            })();

            // 02 - Current Level
            (() => {
                const stageTd = document.createElement('td');
                const deltaTd = document.createElement('td');

                const floodValue = location['flood'] ? location['flood']['constant-value'] : null;
                const stageTsid = location?.['tsid-stage']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (stageTsid) {
                    fetchAndUpdateStageTd(stageTd, deltaTd, stageTsid, floodValue, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl);
                }

                row.appendChild(stageTd);
                row.appendChild(deltaTd);
            })();

            // 04 and 05 - Consr and Flood Storage
            (() => {
                const ConsrTd = document.createElement('td');
                const FloodTd = document.createElement('td');

                const topOfConservationLevel = location['top-of-conservation']?.['constant-value'] || null;
                // console.log("topOfConservationLevel: ", topOfConservationLevel);

                const bottomOfConservationLevel = location['bottom-of-conservation']?.['constant-value'] || null;
                // console.log("bottomOfConservationLevel: ", bottomOfConservationLevel);

                const topOfFloodLevel = location['top-of-flood']?.['constant-value'] || null;
                // console.log("topOfFloodLevel: ", topOfFloodLevel);

                const bottomOfFloodLevel = location['bottom-of-flood']?.['constant-value'] || null;
                // console.log("bottomOfFloodLevel: ", bottomOfFloodLevel);

                const floodValue = location['flood'] ? location['flood']['constant-value'] : null;
                const storageTsid = location?.['tsid-lake-storage']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (storageTsid) {
                    fetchAndUpdateStorageTd(ConsrTd, FloodTd, storageTsid, floodValue, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl, topOfConservationLevel, bottomOfConservationLevel, topOfFloodLevel, bottomOfFloodLevel);
                }

                row.appendChild(ConsrTd);
                row.appendChild(FloodTd);
            })();

            // 06 - Precip
            (() => {
                const precipTd = document.createElement('td');

                const precipLakeTsid = location?.['tsid-lake-precip']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (precipLakeTsid) {
                    fetchAndUpdatePrecipTd(precipTd, precipLakeTsid, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl);
                }

                row.appendChild(precipTd);
            })();

            // 07 - Yesterdays Inflow
            (() => {
                const yesterdayInflowTd = document.createElement('td');

                const yesterdayInflowTsid = location?.['tsid-lake-inflow-yesterday']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (yesterdayInflowTsid) {
                    fetchAndUpdateYesterdayInflowTd(yesterdayInflowTd, yesterdayInflowTsid, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl);
                }

                row.appendChild(yesterdayInflowTd);
            })();

            // 08 - Midnight - Controlled Outflow
            // (() => {
            //     const midnightControlledOutflowCell = document.createElement('td');
            //     const midnightControlledOutflowValue = "--";
            //     fetchAndLogMidnightFlowData(location['location-id'], midnightControlledOutflowCell);
            //     midnightControlledOutflowCell.textContent = midnightControlledOutflowValue;
            //     row.appendChild(midnightControlledOutflowCell);
            // })();

            // 09 - Evening - Controlled Outflow
            // (() => {
            //     const eveningControlledOutflowCell = document.createElement('td');
            //     const eveningControlledOutflowValue = "--";
            //     fetchAndLogEveningFlowData(location['location-id'], eveningControlledOutflowCell);
            //     eveningControlledOutflowCell.textContent = eveningControlledOutflowValue;
            //     row.appendChild(eveningControlledOutflowCell);
            // })();

            // 10 - Seasonal Rule Curve
            // (() => {
            //     const seasonalRuleCurveCell = document.createElement('td');
            //     const seasonalRuleCurveValue = "--";
            //     fetchAndLogSeasonalRuleCurveData(location['location-id'], seasonalRuleCurveCell);
            //     seasonalRuleCurveCell.textContent = seasonalRuleCurveValue;
            //     row.appendChild(seasonalRuleCurveCell);
            // })();

            // 11 - Crest - Pool Forecast
            // (() => {
            //     const crestPoolForecastCell = document.createElement('td');
            //     const crestPoolForecastValue = "--";
            //     fetchAndLogPoolForecastData(location['location-id'], crestPoolForecastCell);
            //     crestPoolForecastCell.textContent = crestPoolForecastValue;
            //     row.appendChild(crestPoolForecastCell);
            // })();

            // 12 - Date - Pool Forecast
            // (() => {
            //     const datePoolForecastCell = document.createElement('td');
            //     const datePoolForecastValue = "--";
            //     fetchAndLogPoolForecastDateData(location['location-id'], datePoolForecastCell);
            //     datePoolForecastCell.textContent = datePoolForecastValue;
            //     row.appendChild(datePoolForecastCell);
            // })();

            // 13 - Record Stage
            (() => {
                const recordStageTd = document.createElement('td');
                const recordStage = location['record-stage'];
                const recordStageValue = recordStage ? recordStage['constant-value'] : null;

                // Check if recordStageValue is valid and within the required range
                recordStageTd.textContent = recordStageValue != null && recordStageValue <= 900
                    ? recordStageValue.toFixed(2)
                    : '';

                row.appendChild(recordStageTd);
            })();

            // 14 - Record Date
            (() => {
                const recordDateTd = document.createElement('td');
                const recordDateValue = location['river-mile-hard-coded'] && location['river-mile-hard-coded']['record_stage_date_hard_coded'];
                recordDateTd.textContent = recordDateValue != null ? recordDateValue : "";
                // Set the title for the cell
                recordDateTd.title = "Hard Coded with Json File";
                // Set halo effect using text-shadow with orange color
                recordDateTd.style.textShadow = '0 0 2px rgba(255, 165, 0, 0.7), 0 0 2px rgba(255, 140, 0, 0.5)';

                row.appendChild(recordDateTd);
            })();

            table.appendChild(row);
        });
    });

    // Return the constructed table element
    return table;
}

function createTableMorning(combinedDataRiver, type, nws_day1_date_title, nws_day2_date_title, nws_day3_date_title) {
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
        const columns = ["River Mile", "Gage Station", "Current Level", "24hr Delta"];

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
            // Apply styling for header cells
            th.style.backgroundColor = 'darkblue';
            th.style.color = 'white';
            headerRow.appendChild(th);
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
        basinCell.style.backgroundColor = 'darkblue';
        basinRow.appendChild(basinCell);
        table.appendChild(basinRow);

        basin['assigned-locations'].forEach((location) => {
            const row = document.createElement('tr');

            // 01 - River Mile
            (() => {
                const riverMileCell = document.createElement('td');

                // use hard coded river mile
                (() => {
                    // const riverMileValue = location['river-mile-hard-coded'] && location['river-mile-hard-coded']['river_mile_hard_coded'];
                    // riverMileCell.textContent = riverMileValue != null ? parseFloat(riverMileValue).toFixed(1) : "N/A";
                    // riverMileCell.title = "Hard Coded with Json File";
                    // riverMileCell.style.textShadow = '0 0 2px rgba(255, 165, 0, 0.7), 0 0 2px rgba(255, 140, 0, 0.5)';
                })();

                // use hard coded river mile
                (() => {
                    // Example usage
                    const locationId = location['location-id'];
                    const riverMileObject = location['river-mile'];
                    const riverMileValue = getStationForLocation(locationId, riverMileObject);
                    // console.log(`Station for location ${locationId}: ${riverMileValue}`);
                    riverMileCell.textContent = riverMileValue != null ? parseFloat(riverMileValue).toFixed(1) : "N/A";
                })();


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
                const currentLevelTd = document.createElement('td');
                const linkElement = document.createElement('a');
                linkElement.href = link;
                linkElement.target = '_blank';

                const currentLevel = stageLastValue['value'];
                const floodValue = location['flood'] ? location['flood']['constant-value'] : null;
                const lwrpValue = location['lwrp'] ? location['lwrp']['constant-value'] : null;
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

                    if (lwrpValue != null && currentLevel <= lwrpValue && lwrpValue < 900) {
                        linkElement.style.color = 'red';  // Make text red if currentLevel lower lwrpValue
                    }
                } else {
                    linkElement.textContent = '';  // Display an empty string if currentLevel is null
                }

                currentLevelTd.appendChild(linkElement);
                row.appendChild(currentLevelTd);
            })();

            // 04 - 24hr Delta
            (() => {
                const deltaCell = document.createElement('td');

                // Ensure 'stage-last-value' exists, is an array, and has at least one entry
                const stageLastValue = location['stage-last-value'] && Array.isArray(location['stage-last-value']) && location['stage-last-value'][0];

                // If stageLastValue is valid, get 'delta', otherwise default to null
                const deltaValue = stageLastValue ? stageLastValue['delta'] : null;

                // Display the delta value, or 'N/A' if delta is not available
                deltaCell.textContent = deltaValue != null ? parseFloat(deltaValue).toFixed(2) : '--';
                row.appendChild(deltaCell);
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

function updateLocDataRiverReservoir(locData, type, data, lastValue, day1NwsValue, day2NwsValue, day3NwsValue) {
    const keys = {
        apiDataKey: `${type}-api-data`,
        lastValueKey: `${type}-last-value`,
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

function getStationForLocation(locationId, riverMileObject) {
    if (!Array.isArray(riverMileObject)) {
        console.error("riverMileObject is not an array or is undefined/null");
        return null;
    }
    for (const entry of riverMileObject) {
        const name = entry["stream-location-node"].id.name;
        if (name === locationId) {
            return entry["stream-location-node"]["stream-node"].station || null; // Return station if it exists, else null
        }
    }
    return null; // Return null if no match is found
}

function fetchAdditionalLocationGroupOwnerData(locationId, setBaseUrl, setLocationGroupOwner, office) {
    // Construct the URL
    const additionalDataUrl = `${setBaseUrl}location/group/${setLocationGroupOwner}?office=${office}&category-id=${office}`;

    // Log the URL to ensure it's correctly formatted
    // console.log(`Requesting additional data from URL: ${additionalDataUrl}`);

    return fetch(additionalDataUrl, {
        method: 'GET'
    })
        .then(response => {
            // If response is not OK, log the status and return null
            if (!response.ok) {
                console.warn(`Response not ok for ${locationId}: Status ${response.status}`);
                return null;
            }
            return response.json();
        })
        .then(data => {
            // If data is not null, log the fetched data
            if (data) {
                // console.log(`Fetched additional data for ${locationId}:`, data);
            }
            return data;
        })
        .catch(error => {
            // Catch any errors and log them
            console.error(`Error fetching additional data for ${locationId}:`, error);
            return null; // Return null in case of error
        });
}

// ******************************************************
// ******* Hard Coded Nws Forecast Time *****************
// ******************************************************

async function fetchDataFromNwsForecastsOutput() {
    let url = null;
    url = 'https://wm.mvs.ds.usace.army.mil//php_data_api/public/json/exportNwsForecasts2Json.json';

    // console.log("url: ", url);

    try {
        const response = await fetch(url);
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

function filterDataByTsid(NwsOutput, cwms_ts_id) {
    const filteredData = NwsOutput.filter(item => {
        return item !== null && item.cwms_ts_id_day1 === cwms_ts_id;
    });

    return filteredData;
}

async function fetchAndLogNwsData(nwsForecastTsid, forecastTimeCell) {
    try {
        const NwsOutput = await fetchDataFromNwsForecastsOutput();
        // console.log('NwsOutput:', NwsOutput);

        const filteredData = filterDataByTsid(NwsOutput, nwsForecastTsid);
        // console.log("Filtered NwsOutput Data for", nwsForecastTsid + ":", filteredData);

        // Update the HTML element with filtered data
        updateNwsForecastTimeHTML(filteredData, forecastTimeCell);

        // Further processing of ROutput data as needed
    } catch (error) {
        // Handle errors from fetchDataFromROutput
        console.error('Failed to fetch data:', error);
    }
}

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

async function fetchInBatches(urls) {
    const results = [];

    // Loop over urls array in chunks
    for (let i = 0; i < urls.length; i += BATCH_SIZE) {
        const batch = urls.slice(i, i + BATCH_SIZE);

        // Fetch all URLs in the current batch concurrently
        const batchPromises = batch.map(url =>
            fetch(url)
                .then(response => {
                    if (response.status === 404) return null; // Skip if not found
                    if (!response.ok) throw new Error(`Network response was not ok: ${response.statusText}`);
                    return response.json();
                })
                .catch(error => {
                    console.error(`Problem with the fetch operation for stage TSID data at ${url}:`, error);
                    return null; // Return null on error to prevent batch failure
                })
        );

        // Wait for all requests in the batch to complete and store results
        const batchResults = await Promise.all(batchPromises);
        results.push(...batchResults);
    }

    return results;
}

// ******************************************************
// ******* Hard Coded Lake Outflow and Crest ************
// ******************************************************

async function fetchDataFromROutput() {
    let url = null;
    url = 'https://wm.mvs.ds.usace.army.mil/web_apps/board/public/outputR.json';

    // console.log("url: ", url);

    try {
        const response = await fetch(url);
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

function filterDataByLocationId(ROutput, location_id) {
    const filteredData = {};

    for (const key in ROutput) {
        if (ROutput.hasOwnProperty(key) && key === location_id) {
            filteredData[key] = ROutput[key];
            break; // Since location_id should be unique, we can break early
        }
    }

    return filteredData;
}

async function fetchAndLogMidnightFlowData(location_id, midnightCell) {
    try {
        const ROutput = await fetchDataFromROutput();
        // console.log('ROutput:', ROutput);

        const filteredData = filterDataByLocationId(ROutput, location_id);
        // console.log("Filtered Data for", location_id + ":", filteredData);

        // Update the HTML element with filtered data
        updateFlowMidnightHTML(filteredData, midnightCell);

        // Update the HTML element with filtered data
        // updateFlowEveningHTML(filteredData, eveningCell);

        // Update the HTML element with filtered data
        // updateRuleCurveHTML(filteredData, seasonalRuleCurveCell);

        // Update the HTML element with filtered data
        // updateLakeCrestHTML(filteredData, crestCell);

        // Update the HTML element with filtered data
        // updateLakeCrestDateHTML(filteredData, crestDateCell);

        // Further processing of ROutput data as needed
    } catch (error) {
        // Handle errors from fetchDataFromROutput
        console.error('Failed to fetch data:', error);
    }
}

async function fetchAndLogEveningFlowData(location_id, eveningCell) {
    try {
        const ROutput = await fetchDataFromROutput();
        // console.log('ROutput:', ROutput);

        const filteredData = filterDataByLocationId(ROutput, location_id);
        // console.log("Filtered Data for", location_id + ":", filteredData);

        // Update the HTML element with filtered data
        updateFlowEveningHTML(filteredData, eveningCell);

        // Update the HTML element with filtered data
        // updateRuleCurveHTML(filteredData, seasonalRuleCurveCell);

        // Update the HTML element with filtered data
        // updateLakeCrestHTML(filteredData, crestCell);

        // Update the HTML element with filtered data
        // updateLakeCrestDateHTML(filteredData, crestDateCell);

        // Further processing of ROutput data as needed
    } catch (error) {
        // Handle errors from fetchDataFromROutput
        console.error('Failed to fetch data:', error);
    }
}

async function fetchAndLogSeasonalRuleCurveData(location_id, seasonalRuleCurveCell) {
    try {
        const ROutput = await fetchDataFromROutput();
        // console.log('ROutput:', ROutput);

        const filteredData = filterDataByLocationId(ROutput, location_id);
        // console.log("Filtered Data for", location_id + ":", filteredData);

        // Update the HTML element with filtered data
        updateRuleCurveHTML(filteredData, seasonalRuleCurveCell);

        // Update the HTML element with filtered data
        // updateLakeCrestHTML(filteredData, crestCell);

        // Update the HTML element with filtered data
        // updateLakeCrestDateHTML(filteredData, crestDateCell);

        // Further processing of ROutput data as needed
    } catch (error) {
        // Handle errors from fetchDataFromROutput
        console.error('Failed to fetch data:', error);
    }
}

async function fetchAndLogPoolForecastData(location_id, crestCell) {
    try {
        const ROutput = await fetchDataFromROutput();
        // console.log('ROutput:', ROutput);

        const filteredData = filterDataByLocationId(ROutput, location_id);
        // console.log("Filtered Data for", location_id + ":", filteredData);

        // Update the HTML element with filtered data
        updateLakeCrestHTML(filteredData, crestCell);

        // Update the HTML element with filtered data
        // updateLakeCrestDateHTML(filteredData, crestDateCell);

        // Further processing of ROutput data as needed
    } catch (error) {
        // Handle errors from fetchDataFromROutput
        console.error('Failed to fetch data:', error);
    }
}

async function fetchAndLogPoolForecastDateData(location_id, crestDateCell) {
    try {
        const ROutput = await fetchDataFromROutput();
        // console.log('ROutput:', ROutput);

        const filteredData = filterDataByLocationId(ROutput, location_id);
        // console.log("Filtered Data for", location_id + ":", filteredData);

        // Update the HTML element with filtered data
        updateLakeCrestDateHTML(filteredData, crestDateCell);

        // Further processing of ROutput data as needed
    } catch (error) {
        // Handle errors from fetchDataFromROutput
        console.error('Failed to fetch data:', error);
    }
}

function updateFlowMidnightHTML(filteredData, midnightCell) {
    const locationData = filteredData[Object.keys(filteredData)[0]]; // Get the first (and only) key's data
    midnightCell.innerHTML = `<div class="hard_coded_php" title="Uses PHP Json Output, No Cloud Option to Access Custom Schema Yet">${locationData.outflow_midnight}</div>`;
}

function updateFlowEveningHTML(filteredData, eveningCell) {
    const locationData = filteredData[Object.keys(filteredData)[0]]; // Get the first (and only) key's data
    eveningCell.innerHTML = `<div class="hard_coded_php" title="Uses PHP Json Output, No Cloud Option to Access Custom Schema Yet">${locationData.outflow_evening}</div>`;
}

function updateRuleCurveHTML(filteredData, seasonalRuleCurveCell) {
    const locationData = filteredData[Object.keys(filteredData)[0]]; // Get the first (and only) key's data
    seasonalRuleCurveCell.innerHTML = `<div class="hard_coded_php" title="Uses PHP Json Output, No Cloud Option to Access Custom Schema Yet">${(parseFloat(locationData.rule_curve)).toFixed(2)}</div>`;
}

function updateLakeCrestHTML(filteredData, crestCell) {
    const locationData = filteredData[Object.keys(filteredData)[0]]; // Get the first (and only) key's data
    if (locationData.crest) {
        crestCell.innerHTML = `<div class="hard_coded_php" title="Uses PHP Json Output, No Cloud Option to Access Custom Schema Yet">${locationData.crest}</div>`;
    } else {
        crestCell.innerHTML = `<div class="hard_coded_php" title="Uses PHP Json Output, No Cloud Option to Access Custom Schema Yet"></div>`;
    }
}

function updateLakeCrestDateHTML(filteredData, crestDateCell) {
    const locationData = filteredData[Object.keys(filteredData)[0]]; // Get the first (and only) key's data
    if (locationData.crest) {
        crestDateCell.innerHTML = `<div class="hard_coded_php" title="Uses PHP Json Output, No Cloud Option to Access Custom Schema Yet">${locationData.crest_date_time}</div>`;
    } else {
        crestDateCell.innerHTML = `<div class="hard_coded_php" title="Uses PHP Json Output, No Cloud Option to Access Custom Schema Yet"></div>`;
    }
}

/******************************************************************************
 *                               FETCH CDA FUNCTIONS                          *
 ******************************************************************************/
function fetchAndUpdateStageTd(stageTd, DeltaTd, tsidStage, flood_level, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl) {
    return new Promise((resolve, reject) => {
        if (tsidStage !== null) {
            const urlStage = `${setBaseUrl}timeseries?name=${tsidStage}&begin=${currentDateTimeMinus30Hours.toISOString()}&end=${currentDateTime.toISOString()}&office=${office}`;

            // console.log("urlStage = ", urlStage);
            fetch(urlStage, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json;version=2'
                }
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(stage => {
                    stage.values.forEach(entry => {
                        entry[0] = formatNWSDate(entry[0]);
                    });

                    const lastNonNullValue = getLastNonNullValue(stage);
                    let valueLast = null;
                    let timestampLast = null;

                    if (lastNonNullValue !== null) {
                        timestampLast = lastNonNullValue.timestamp;
                        valueLast = parseFloat(lastNonNullValue.value).toFixed(2);
                    }

                    const c_count = calculateCCount(tsidStage);
                    const lastNonNull24HoursValue = getLastNonNull24HoursValue(stage, c_count);
                    let value24HoursLast = null;
                    let timestamp24HoursLast = null;

                    if (lastNonNull24HoursValue !== null) {
                        timestamp24HoursLast = lastNonNull24HoursValue.timestamp;
                        value24HoursLast = parseFloat(lastNonNull24HoursValue.value).toFixed(2);
                    }

                    const delta_24 = (valueLast !== null && value24HoursLast !== null)
                        ? (valueLast - value24HoursLast).toFixed(2)
                        : null;

                    let innerHTMLStage;
                    if (valueLast === null) {
                        innerHTMLStage = "<span class='missing'>-M-</span>";
                    } else {
                        const floodClass = determineStageClass(valueLast, flood_level);
                        innerHTMLStage = `<span class='${floodClass}' title='${stage.name}, Value = ${valueLast}, Date Time = ${timestampLast}'>
                                            <a href='../chart?office=${office}&cwms_ts_id=${stage.name}&lookback=4' target='_blank'>
                                                ${valueLast}
                                            </a>
                                         </span>`;
                    }

                    stageTd.innerHTML = innerHTMLStage;
                    DeltaTd.innerHTML = delta_24 !== null ? delta_24 : "-";

                    resolve({ stageTd: valueLast, deltaTd: delta_24 });
                })
                .catch(error => {
                    console.error("Error fetching or processing data:", error);
                    reject(error);
                });
        } else {
            resolve({ stageTd: null, deltaTd: null });
        }
    });
}

function fetchAndUpdateNwsForecastTd(tsidStage, nwsForecastTsid, flood_level, currentDateTime, currentDateTimePlus4Days, setBaseUrl) {
    return new Promise((resolve, reject) => {
        const { currentDateTimeMidNightISO, currentDateTimePlus4DaysMidNightISO } = generateDateTimeMidNightStringsISO(currentDateTime, currentDateTimePlus4Days);

        if (tsidStage !== null && tsidStage.slice(-2) !== "29" && nwsForecastTsid !== null) {
            const urlNWS = `${setBaseUrl}timeseries?name=${nwsForecastTsid}&begin=${currentDateTimeMidNightISO}&end=${currentDateTimePlus4DaysMidNightISO}&office=${office}`;

            fetch(urlNWS, {
                method: 'GET',
                headers: { 'Accept': 'application/json;version=2' }
            })
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                })
                .then(nws3Days => {
                    nws3Days.values.forEach(entry => {
                        entry[0] = formatNWSDate(entry[0]);
                    });

                    const valuesWithTimeNoon = extractValuesWithTimeNoon(nws3Days.values);

                    const getFormattedValue = (arr, index) => {
                        const rawValue = arr?.[index]?.[1];
                        return rawValue !== null && rawValue !== undefined && !isNaN(parseFloat(rawValue))
                            ? parseFloat(rawValue).toFixed(2)
                            : "-";
                    };

                    const firstMiddleValue = getFormattedValue(valuesWithTimeNoon, 1);
                    const secondMiddleValue = getFormattedValue(valuesWithTimeNoon, 2);
                    const thirdMiddleValue = getFormattedValue(valuesWithTimeNoon, 3);

                    resolve({ nwsDay1Td: firstMiddleValue, nwsDay2Td: secondMiddleValue, nwsDay3Td: thirdMiddleValue });
                })
                .catch(error => {
                    console.error("Error fetching or processing data:", error);
                    reject(error);
                });
        } else {
            resolve({ nwsDay1Td: "", nwsDay2Td: "", nwsDay3Td: "" });
        }
    });
}

function fetchAndUpdateNWSForecastDate(stageCell, nwsForecastTsid) {
    fetchAndLogNwsData(stageCell, nwsForecastTsid); // Fetch and update the data
}

function fetchAndUpdateCrestTd(stageTd, DeltaTd, tsidStage, flood_level, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl) {
    return new Promise((resolve, reject) => {
        if (tsidStage !== null) {
            const urlStage = `${setBaseUrl}timeseries?name=${tsidStage}&begin=${currentDateTimeMinus30Hours.toISOString()}&end=${currentDateTime.toISOString()}&office=${office}`;

            // console.log("urlStage = ", urlStage);
            fetch(urlStage, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json;version=2'
                }
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(stage => {
                    stage.values.forEach(entry => {
                        entry[0] = formatNWSDate(entry[0]);
                    });

                    const lastNonNullValue = getLastNonNullValue(stage);
                    let valueLast = null;
                    let timestampLast = null;

                    if (lastNonNullValue !== null) {
                        timestampLast = lastNonNullValue.timestamp;
                        valueLast = parseFloat(lastNonNullValue.value).toFixed(2);
                    }

                    const c_count = calculateCCount(tsidStage);
                    const lastNonNull24HoursValue = getLastNonNull24HoursValue(stage, c_count);
                    let value24HoursLast = null;
                    let timestamp24HoursLast = null;

                    if (lastNonNull24HoursValue !== null) {
                        timestamp24HoursLast = lastNonNull24HoursValue.timestamp;
                        value24HoursLast = parseFloat(lastNonNull24HoursValue.value).toFixed(2);
                    }

                    const delta_24 = (valueLast !== null && value24HoursLast !== null)
                        ? (valueLast - value24HoursLast).toFixed(2)
                        : null;

                    let innerHTMLStage;
                    if (valueLast === null) {
                        innerHTMLStage = "<span class='missing'></span>";
                    } else {
                        const floodClass = determineStageClass(valueLast, flood_level);
                        innerHTMLStage = `<span class='${floodClass}' title='${stage.name}, Value = ${valueLast}, Date Time = ${timestampLast}'>
                                            <a href='../chart?office=${office}&cwms_ts_id=${stage.name}&lookback=4' target='_blank'>
                                                ${valueLast}
                                            </a>
                                         </span>`;
                    }

                    stageTd.innerHTML = innerHTMLStage;
                    DeltaTd.innerHTML = delta_24 !== null ? delta_24 : "";

                    resolve({ stageTd: valueLast, deltaTd: delta_24 });
                })
                .catch(error => {
                    console.error("Error fetching or processing data:", error);
                    reject(error);
                });
        } else {
            resolve({ stageTd: null, deltaTd: null });
        }
    });
}

function fetchAndUpdateFlow(flowCell, tsidFlow, label, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl) {
    if (tsidFlow !== null) {
        const urlFlow = `${setBaseUrl}timeseries?name=${tsidFlow}&begin=${currentDateTimeMinus30Hours.toISOString()}&end=${currentDateTime.toISOString()}&office=${office}`;

        // console.log("urlFlow = ", urlFlow);
        // Fetch the time series data from the API using the determined query string
        fetch(urlFlow, {
            method: 'GET',
            headers: {
                'Accept': 'application/json;version=2'
            }
        })
            .then(response => {
                // Check if the response is ok
                if (!response.ok) {
                    // If not, throw an error
                    throw new Error('Network response was not ok');
                }
                // If response is ok, parse it as JSON
                return response.json();
            })
            .then(flow => {
                // Once data is fetched, log the fetched data structure
                // console.log("flow: ", flow);

                // Convert timestamps in the JSON object
                flow.values.forEach(entry => {
                    entry[0] = formatNWSDate(entry[0]); // Update timestamp
                });

                // Output the updated JSON object
                // // console.log(JSON.stringify(flow, null, 2));

                // console.log("flowFormatted = ", flow);

                // FLOW CLASS
                if (label === "COE") {
                    var myFlowLabelClass = "flow_coe";
                } else if (label === "USGS") {
                    var myFlowLabelClass = "flow_usgs";
                } else if (label === "NWS") {
                    var myFlowLabelClass = "flow_nws";
                } else if (label === "MVR") {
                    var myFlowLabelClass = "flow_coe_mvr";
                } else if (label === "USGSRAW") {
                    var myFlowLabelClass = "flow_usgsraw";
                } else if (label === "SLOPEADJ") {
                    var myFlowLabelClass = "flow_slopeadj";
                } else {
                    var myFlowLabelClass = "flow";
                }
                // console.log("myFlowLabelClass = ", myFlowLabelClass);

                // Get the last non-null value from the stage data
                const lastNonNullFlowValue = getLastNonNullValue(flow);
                // Check if a non-null value was found
                if (lastNonNullFlowValue !== null) {
                    // Extract timestamp, value, and quality code from the last non-null value
                    var timestampFlowLast = lastNonNullFlowValue.timestamp;
                    var valueFlowLast = parseFloat(lastNonNullFlowValue.value).toFixed(0);
                    var qualityCodeFlowLast = lastNonNullFlowValue.qualityCode;

                    // Log the extracted valueLasts
                    // console.log("timestampFlowLast:", timestampFlowLast);
                    // console.log("valueFlowLast:", valueFlowLast);
                    // console.log("qualityCodeFlowLast:", qualityCodeFlowLast);
                } else {
                    // If no non-null valueLast is found, log a message
                    // console.log("No non-null valueLast found.");
                }

                const c_count = calculateCCount(tsidFlow);

                const lastNonNull24HoursFlowValue = getLastNonNull24HoursValue(flow, c_count);
                // console.log("lastNonNull24HoursFlowValue:", lastNonNull24HoursFlowValue);

                // Check if a non-null value was found
                if (lastNonNull24HoursFlowValue !== null) {
                    // Extract timestamp, value, and quality code from the last non-null value
                    var timestampFlow24HoursLast = lastNonNull24HoursFlowValue.timestamp;
                    var valueFlow24HoursLast = parseFloat(lastNonNull24HoursFlowValue.value).toFixed(0);
                    var qualityCodeFlow24HoursLast = lastNonNull24HoursFlowValue.qualityCode;

                    // Log the extracted valueLasts
                    // console.log("timestampFlow24HoursLast:", timestampFlow24HoursLast);
                    // console.log("valueFlow24HoursLast:", valueFlow24HoursLast);
                    // console.log("qualityCodeFlow24HoursLast:", qualityCodeFlow24HoursLast);
                } else {
                    // If no non-null valueLast is found, log a message
                    // console.log("No non-null valueLast found.");
                }

                // Calculate the 24 hours change between first and last value
                const delta24Flow = (valueFlowLast - valueFlow24HoursLast).toFixed(0);
                // console.log("delta24Flow:", delta24Flow);


                // Check if the value is greater than or equal to 1000
                if (parseFloat(delta24Flow) >= 1000 || delta24Flow <= -1000) {
                    // If greater than or equal to 1000, round to the nearest tenth and add commas at thousands place
                    roundedDelta24Flow = (Math.round(parseFloat(delta24Flow) / 10) * 10).toLocaleString();
                } else {
                    // If less than 1000, simply add commas at thousands place
                    roundedDelta24Flow = (parseFloat(delta24Flow)).toLocaleString();
                }
                // console.log("roundedDelta24Flow = ", roundedDelta24Flow); // Log the rounded and formatted value to the console

                // Check if the value is greater than or equal to 1000
                if (parseFloat(valueFlowLast) >= 1000) {
                    // If greater than or equal to 1000, round to the nearest tenth and add commas at thousands place
                    roundedValueFlowLast = (Math.round(parseFloat(valueFlowLast) / 10) * 10).toLocaleString();
                } else {
                    // If less than 1000, simply add commas at thousands place
                    roundedValueFlowLast = (parseFloat(valueFlowLast)).toLocaleString();
                }
                // console.log("roundedValueFlowLast = ", roundedValueFlowLast); // Log the rounded and formatted value to the console


                // Format the last valueLast's timestampFlowLast to a string
                const formattedLastValueTimeStamp = formatTimestampToStringIOS(timestampFlowLast);
                // console.log("formattedLastValueTimeStamp = ", formattedLastValueTimeStamp);


                // Create a Date object from the timestampFlowLast
                const timeStampDateObject = new Date(timestampFlowLast);
                // console.log("timeStampDateObject = ", timeStampDateObject);


                // Subtract 24 hours (24 * 60 * 60 * 1000 milliseconds) from the timestampFlowLast date
                const timeStampDateObjectMinus24Hours = new Date(timestampFlowLast - (24 * 60 * 60 * 1000));
                // console.log("timeStampDateObjectMinus24Hours = ", timeStampDateObjectMinus24Hours);


                // DATATIME CLASS
                var dateTimeClass = determineDateTimeClass(timeStampDateObject, currentDateTimeMinus2Hours);
                // console.log("dateTimeClass:", dateTimeClass);


                if (lastNonNullFlowValue === null) {
                    innerHTMLFlow = "<span class='missing'>"
                        + "-M-"
                        + "</span>"
                        + "<span class='temp_water'>"
                        + "label"
                        + "</span>";
                } else {
                    innerHTMLFlow = "<span class='last_max_value' title='" + flow.name + ", Value = " + roundedValueFlowLast + ", Date Time = " + timestampFlowLast + "'>"
                        + "<a href='../chart?office=" + office + "&cwms_ts_id=" + flow.name + "&lookback=4&cda=internal' target='_blank'>"
                        + roundedValueFlowLast
                        + "</a>"
                        + "</span>"
                        + " "
                        + flow.units
                        + " (" + "<span title='" + flow.name + ", Value = " + roundedValueFlowLast + ", Date Time = " + timestampFlow24HoursLast + ", Delta = (" + valueFlowLast + " - " + valueFlow24HoursLast + ") = " + roundedDelta24Flow + "'>" + roundedDelta24Flow + "</span>" + ")"
                        + "<br>"
                        + "<span class='" + dateTimeClass + "'>"
                        + formattedLastValueTimeStamp
                        + "</span>"
                        + "<span class='" + myFlowLabelClass + "'>"
                        + label
                        + "</span>";
                }
                return flowCell.innerHTML += innerHTMLFlow;
            })
            .catch(error => {
                // Catch and log any errors that occur during fetching or processing
                console.error("Error fetching or processing data:", error);
            });
    }
}

function fetchAndUpdatePrecipTd(precipCell, tsid, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl) {
    if (tsid !== null) {
        // Fetch the time series data from the API using the determined query string
        const urlPrecip = `${setBaseUrl}timeseries?name=${tsid}&begin=${currentDateTimeMinus30Hours.toISOString()}&end=${currentDateTime.toISOString()}&office=${office}`;
        // console.log("urlPrecip = ", urlPrecip);

        fetch(urlPrecip, {
            method: 'GET',
            headers: {
                'Accept': 'application/json;version=2'
            }
        })
            .then(response => {
                // Check if the response is ok
                if (!response.ok) {
                    // If not, throw an error
                    throw new Error('Network response was not ok');
                }
                // If response is ok, parse it as JSON
                return response.json();
            })
            .then(precip => {
                // Once data is fetched, log the fetched data structure
                // console.log("precip: ", precip);

                // Convert timestamps in the JSON object
                precip.values.forEach(entry => {
                    entry[0] = formatNWSDate(entry[0]); // Update timestamp
                });

                // Output the updated JSON object
                // // console.log(JSON.stringify(precip, null, 2));

                // console.log("precipFormatted = ", precip);

                // Get the last non-null value from the stage data
                const lastNonNullPrecipValue = getLastNonNullValue(precip);
                // console.log("lastNonNullPrecipValue:", lastNonNullPrecipValue);

                // Check if a non-null value was found
                if (lastNonNullPrecipValue !== null) {
                    // Extract timestamp, value, and quality code from the last non-null value
                    var timestampPrecipLast = lastNonNullPrecipValue.timestamp;
                    var valuePrecipLast = parseFloat(lastNonNullPrecipValue.value).toFixed(2);
                    var qualityCodePrecipLast = lastNonNullPrecipValue.qualityCode;

                    // Log the extracted valueLasts
                    // console.log("timestampPrecipLast:", timestampPrecipLast);
                    // console.log("valuePrecipLast:", valuePrecipLast);
                    // console.log("qualityCodePrecipLast:", qualityCodePrecipLast);
                } else {
                    // If no non-null valueLast is found, log a message
                    // console.log("No non-null valueLast found.");
                }

                const c_count = calculateCCount(tsid);

                const lastNonNull6HoursPrecipValue = getLastNonNull6HoursValue(precip, c_count);
                // console.log("lastNonNull6HoursPrecipValue:", lastNonNull6HoursPrecipValue);

                // Check if a non-null value was found
                if (lastNonNull6HoursPrecipValue !== null) {
                    // Extract timestamp, value, and quality code from the last non-null value
                    var timestampPrecip6HoursLast = lastNonNull6HoursPrecipValue.timestamp;
                    var valuePrecip6HoursLast = parseFloat(lastNonNull6HoursPrecipValue.value).toFixed(2);
                    var qualityCodePrecip6HoursLast = lastNonNull6HoursPrecipValue.qualityCode;

                    // Log the extracted valueLasts
                    // console.log("timestampPrecip6HoursLast:", timestampPrecip6HoursLast);
                    // console.log("valuePrecip6HoursLast:", valuePrecip6HoursLast);
                    // console.log("qualityCodePrecip6HoursLast:", qualityCodePrecip6HoursLast);
                } else {
                    // If no non-null valueLast is found, log a message
                    // console.log("No non-null valueLast found.");
                }

                const lastNonNull24HoursPrecipValue = getLastNonNull24HoursValue(precip, c_count);
                // console.log("lastNonNull24HoursPrecipValue:", lastNonNull24HoursPrecipValue);

                // Check if a non-null value was found
                if (lastNonNull24HoursPrecipValue !== null) {
                    // Extract timestamp, value, and quality code from the last non-null value
                    var timestampPrecip24HoursLast = lastNonNull24HoursPrecipValue.timestamp;
                    var valuePrecip24HoursLast = parseFloat(lastNonNull24HoursPrecipValue.value).toFixed(2);
                    var qualityCodePrecip24HoursLast = lastNonNull24HoursPrecipValue.qualityCode;

                    // Log the extracted valueLasts
                    // console.log("timestampPrecip24HoursLast:", timestampPrecip24HoursLast);
                    // console.log("valuePrecip24HoursLast:", valuePrecip24HoursLast);
                    // console.log("qualityCodePrecip24HoursLast:", qualityCodePrecip24HoursLast);
                } else {
                    // If no non-null valueLast is found, log a message
                    // console.log("No non-null valueLast found.");
                }

                // Calculate the 24 hours change between first and last value
                const precip_delta_6 = (valuePrecipLast - valuePrecip6HoursLast).toFixed(2);
                // console.log("precip_delta_6:", precip_delta_6);

                // Calculate the 24 hours change between first and last value
                const precip_delta_24 = (valuePrecipLast - valuePrecip24HoursLast).toFixed(2);
                // console.log("precip_delta_24:", precip_delta_24);

                // Format the last valueLast's timestampFlowLast to a string
                const formattedLastValueTimeStamp = formatTimestampToStringIOS(timestampPrecipLast);
                // console.log("formattedLastValueTimeStamp = ", formattedLastValueTimeStamp);

                // Create a Date object from the timestampFlowLast
                const timeStampDateObject = new Date(timestampPrecipLast);
                // console.log("timeStampDateObject = ", timeStampDateObject);

                // Subtract 24 hours (24 * 60 * 60 * 1000 milliseconds) from the timestampFlowLast date
                const timeStampDateObjectMinus24Hours = new Date(timestampPrecipLast - (24 * 60 * 60 * 1000));
                // console.log("timeStampDateObjectMinus24Hours = ", timeStampDateObjectMinus24Hours);

                // DATATIME CLASS
                var dateTimeClass = determineDateTimeClass(timeStampDateObject, currentDateTimeMinus2Hours);
                // console.log("dateTimeClass:", dateTimeClass);

                if (lastNonNullPrecipValue === null) {
                    innerHTMLPrecip = "<table id='precip'>"
                        + "<tr>"
                        + "<td class='precip_missing' title='24 hr delta'>"
                        + "-M-"
                        + "</td>"
                        + "</tr>"
                        + "</table>";
                } else {
                    innerHTMLPrecip = "</table>"
                        + "<span class='last_max_value' title='" + precip.name + ", Value = " + valuePrecipLast + ", Date Time = " + timestampPrecipLast + "'>"
                        + "<a href='../chart?office=" + office + "&cwms_ts_id=" + precip.name + "&lookback=4' target='_blank'>"
                        + valuePrecipLast
                        + "</a>"
                        + "</span>";
                }
                return precipCell.innerHTML += innerHTMLPrecip;
            })
            .catch(error => {
                // Catch and log any errors that occur during fetching or processing
                console.error("Error fetching or processing data:", error);
            });
    } else {
        return precipCell.innerHTML = "";
    }
}

function fetchAndUpdateYesterdayInflowTd(precipCell, tsid, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl) {
    if (tsid !== null) {
        // Fetch the time series data from the API using the determined query string
        const urlPrecip = `${setBaseUrl}timeseries?name=${tsid}&begin=${currentDateTimeMinus30Hours.toISOString()}&end=${currentDateTime.toISOString()}&office=${office}`;
        // console.log("urlPrecip = ", urlPrecip);

        fetch(urlPrecip, {
            method: 'GET',
            headers: {
                'Accept': 'application/json;version=2'
            }
        })
            .then(response => {
                // Check if the response is ok
                if (!response.ok) {
                    // If not, throw an error
                    throw new Error('Network response was not ok');
                }
                // If response is ok, parse it as JSON
                return response.json();
            })
            .then(precip => {
                // Once data is fetched, log the fetched data structure
                // console.log("precip: ", precip);

                // Convert timestamps in the JSON object
                precip.values.forEach(entry => {
                    entry[0] = formatNWSDate(entry[0]); // Update timestamp
                });

                // Output the updated JSON object
                // // console.log(JSON.stringify(precip, null, 2));

                // console.log("precipFormatted = ", precip);

                // Get the last non-null value from the stage data
                const lastNonNullPrecipValue = getLastNonNullValue(precip);
                // console.log("lastNonNullPrecipValue:", lastNonNullPrecipValue);

                // Check if a non-null value was found
                if (lastNonNullPrecipValue !== null) {
                    // Extract timestamp, value, and quality code from the last non-null value
                    var timestampPrecipLast = lastNonNullPrecipValue.timestamp;
                    var valuePrecipLast = parseFloat(lastNonNullPrecipValue.value).toFixed(0);
                    var qualityCodePrecipLast = lastNonNullPrecipValue.qualityCode;

                    // Log the extracted valueLasts
                    // console.log("timestampPrecipLast:", timestampPrecipLast);
                    // console.log("valuePrecipLast:", valuePrecipLast);
                    // console.log("qualityCodePrecipLast:", qualityCodePrecipLast);
                } else {
                    // If no non-null valueLast is found, log a message
                    // console.log("No non-null valueLast found.");
                }

                if (lastNonNullPrecipValue === null) {
                    innerHTMLPrecip = "<table id='precip'>"
                        + "<tr>"
                        + "<td class='precip_missing' title='24 hr delta'>"
                        + "-M-"
                        + "</td>"
                        + "</tr>"
                        + "</table>";
                } else {
                    innerHTMLPrecip = "</table>"
                        + "<span class='last_max_value' title='" + precip.name + ", Value = " + valuePrecipLast + ", Date Time = " + timestampPrecipLast + "'>"
                        + "<a href='../chart?office=" + office + "&cwms_ts_id=" + precip.name + "&lookback=4' target='_blank'>"
                        + valuePrecipLast
                        + "</a>"
                        + "</span>";
                }
                return precipCell.innerHTML += innerHTMLPrecip;
            })
            .catch(error => {
                // Catch and log any errors that occur during fetching or processing
                console.error("Error fetching or processing data:", error);
            });
    } else {
        return precipCell.innerHTML = "";
    }
}

function fetchAndUpdateWaterQuality(waterQualityCell, tsid, label, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, currentDateTimeMinus8Hours, setBaseUrl) {
    if (tsid !== null) {
        // Fetch the time series data from the API using the determined query string
        const urlWaterQuality = `${setBaseUrl}timeseries?name=${tsid}&begin=${currentDateTimeMinus30Hours.toISOString()}&end=${currentDateTime.toISOString()}&office=${office}`;
        // console.log("urlWaterQuality = ", urlWaterQuality);

        fetch(urlWaterQuality, {
            method: 'GET',
            headers: {
                'Accept': 'application/json;version=2'
            }
        })
            .then(response => {
                // Check if the response is ok
                if (!response.ok) {
                    // If not, throw an error
                    throw new Error('Network response was not ok');
                }
                // If response is ok, parse it as JSON
                return response.json();
            })
            .then(waterQuality => {
                // Once data is fetched, log the fetched data structure
                // console.log("waterQuality:", waterQuality);

                // Convert timestamps in the JSON object
                waterQuality.values.forEach(entry => {
                    entry[0] = formatNWSDate(entry[0]); // Update timestamp
                });

                // Output the updated JSON object
                // // console.log(JSON.stringify(waterQuality, null, 2));

                // console.log("lastNonNullWaterQualityValue = ", waterQuality);

                // console.log("tsid = ", tsid);
                // console.log("label = ", label);

                // WATER QUALITY CLASS
                var myWaterQualityClass = "";

                // Ensure label is a string before calling includes()
                if (typeof label === "string") {
                    if (label.includes("AIR")) {
                        myWaterQualityClass = "water_quality_temp_air";
                    } else if (label.includes("WATER")) {
                        myWaterQualityClass = "water_quality_temp_water";
                    } else if (label.includes("DO")) {
                        myWaterQualityClass = "water_quality_do";
                    } else if (label.includes("DEPTH")) {
                        myWaterQualityClass = "water_quality_depth";
                    } else if (label.includes("COND")) {
                        myWaterQualityClass = "water_quality_cond";
                    } else if (label.includes("PH")) {
                        myWaterQualityClass = "water_quality_ph";
                    } else if (label.includes("TURB")) {
                        myWaterQualityClass = "water_quality_turb";
                    } else if (label.includes("SPEED")) {
                        myWaterQualityClass = "water_quality_speed_wind";
                    } else if (label.includes("PRESSURE")) {
                        myWaterQualityClass = "water_quality_pressure";
                    } else if (label.includes("DIR")) {
                        myWaterQualityClass = "water_quality_dir_wind";
                    } else if (label.includes("NITRATE")) {
                        myWaterQualityClass = "water_quality_nitrate";
                    } else if (label.includes("CHLOROPHYLL")) {
                        myWaterQualityClass = "water_quality_chlorophyll";
                    } else if (label.includes("PHYCOCYANIN")) {
                        myWaterQualityClass = "water_quality_phycocyanin";
                    }
                } else {
                    // Default class if label is null, undefined, or not a string
                    myWaterQualityClass = "water_quality_do";
                }
                // console.log("myWaterQualityClass = ", myWaterQualityClass);


                // Get the last non-null value from the stage data
                const lastNonNullWaterQualityValue = getLastNonNullValue(waterQuality);
                // console.log("lastNonNullWaterQualityValue = ", lastNonNullWaterQualityValue);
                // console.log("lastNonNullWaterQualityValue = ", typeof(lastNonNullWaterQualityValue));

                // Check if a non-null value was found
                if (lastNonNullWaterQualityValue !== null) {
                    // Extract timestamp, value, and quality code from the last non-null value
                    var timestampWaterQualityLast = lastNonNullWaterQualityValue.timestamp;
                    var valueWaterQualityLast = parseFloat(lastNonNullWaterQualityValue.value).toFixed(0);
                    var qualityCodeWaterQualityLast = lastNonNullWaterQualityValue.qualityCode;

                    // Log the extracted valueLasts
                    // console.log("timestampWaterQualityLast:", timestampWaterQualityLast);
                    // console.log("valueWaterQualityLast:", valueWaterQualityLast);
                    // console.log("qualityCodeWaterQualityLast:", qualityCodeWaterQualityLast);
                } else {
                    // If no non-null valueLast is found, log a message
                    // console.log("No non-null valueLast found.");
                }


                const c_count = calculateCCount(tsid);


                const lastNonNull24HoursWaterQualityValue = getLastNonNull24HoursValue(waterQuality, c_count);
                // console.log("lastNonNull24HoursWaterQualityValue:", lastNonNull24HoursWaterQualityValue);


                // Check if a non-null value was found
                if (lastNonNull24HoursWaterQualityValue !== null) {
                    // Extract timestamp, value, and quality code from the last non-null value
                    var timestampWaterQuality24HoursLast = lastNonNull24HoursWaterQualityValue.timestamp;
                    var valueWaterQuality24HoursLast = parseFloat(lastNonNull24HoursWaterQualityValue.value).toFixed(0);
                    var qualityCodeWaterQuality24HoursLast = lastNonNull24HoursWaterQualityValue.qualityCode;

                    // Log the extracted valueLasts
                    // console.log("timestampWaterQuality24HoursLast:", timestampWaterQuality24HoursLast);
                    // console.log("valueWaterQuality24HoursLast:", valueWaterQuality24HoursLast);
                    // console.log("qualityCodeWaterQuality24HoursLast:", qualityCodeWaterQuality24HoursLast);
                } else {
                    // If no non-null valueLast is found, log a message
                    // console.log("No non-null valueLast found.");
                }

                // Calculate the 24 hours change between first and last value
                const delta_24_water_quality = (valueWaterQualityLast - valueWaterQuality24HoursLast).toFixed(0);
                // console.log("delta_24_water_quality:", delta_24_water_quality);

                // Format the last valueLast's timestampFlowLast to a string
                const formattedLastValueTimeStamp = formatTimestampToStringIOS(timestampWaterQualityLast);
                // console.log("formattedLastValueTimeStamp = ", formattedLastValueTimeStamp);

                // Create a Date object from the timestampFlowLast
                const timeStampDateObject = new Date(timestampWaterQualityLast);
                // console.log("timeStampDateObject = ", timeStampDateObject);

                // Subtract 24 hours (24 * 60 * 60 * 1000 milliseconds) from the timestampFlowLast date
                const timeStampDateObjectMinus24Hours = new Date(timestampWaterQualityLast - (24 * 60 * 60 * 1000));
                // console.log("timeStampDateObjectMinus24Hours = ", timeStampDateObjectMinus24Hours);

                // DATATIME CLASS
                var dateTimeClass = determineDateTimeClassWaterQuality(timeStampDateObject, currentDateTimeMinus2Hours, currentDateTimeMinus8Hours, label);
                // console.log("dateTimeClass:", dateTimeClass);

                if (lastNonNullWaterQualityValue === null) {
                    innerHTMLWaterQuality = "<span class='missing' title='" + waterQuality.name + "'>"
                        + "-M-"
                        + "</span>"
                        + "<span class='" + myWaterQualityClass + "'>"
                        + label
                        + "</span>";
                } else if (valueWaterQualityLast > 1000) {
                    innerHTMLWaterQuality = "<span class='blinking-text' title='" + waterQuality.name + ", Value = " + valueWaterQualityLast + ", Date Time = " + timestampWaterQualityLast + "'>"
                        + "<a href='../chart?office=" + office + "&cwms_ts_id=" + waterQuality.name + "&lookback=4&cda=internal' target='_blank'>"
                        + valueWaterQualityLast
                        + "</a>"
                        + "</span>"
                        + " "
                        + waterQuality.units
                        + " (" + "<span title='" + waterQuality.name + ", Value = " + valueWaterQuality24HoursLast + ", Date Time = " + timestampWaterQuality24HoursLast + ", Delta = (" + valueWaterQualityLast + " - " + valueWaterQuality24HoursLast + ") = " + delta_24_water_quality + "'>" + delta_24_water_quality + "</span>" + ")"
                        + "<br>"
                        + "<span class='" + dateTimeClass + "'>"
                        + formattedLastValueTimeStamp
                        + "</span>"
                        + "<span class='" + myWaterQualityClass + "'>"
                        + label
                        + "</span>";
                } else {
                    innerHTMLWaterQuality = "<span class='last_max_value' title='" + waterQuality.name + ", Value = " + valueWaterQualityLast + ", Date Time = " + timestampWaterQualityLast + "'>"
                        + "<a href='../chart?office=" + office + "&cwms_ts_id=" + waterQuality.name + "&lookback=4&cda=internal' target='_blank'>"
                        + valueWaterQualityLast
                        + "</a>"
                        + "</span>"
                        + " "
                        + waterQuality.units
                        + " (" + "<span title='" + waterQuality.name + ", Value = " + valueWaterQuality24HoursLast + ", Date Time = " + timestampWaterQuality24HoursLast + ", Delta = (" + valueWaterQualityLast + " - " + valueWaterQuality24HoursLast + ") = " + delta_24_water_quality + "'>" + delta_24_water_quality + "</span>" + ")"
                        + "<br>"
                        + "<span class='" + dateTimeClass + "'>"
                        + formattedLastValueTimeStamp
                        + "</span>"
                        + "<span class='" + myWaterQualityClass + "'>"
                        + label
                        + "</span>";
                }
                return waterQualityCell.innerHTML += innerHTMLWaterQuality;
            })
            .catch(error => {
                // Catch and log any errors that occur during fetching or processing
                console.error("Error fetching or processing data:", error);
            });
    }
}

function fetchAndUpdateStorageTd(stageTd, DeltaTd, tsidStorage, flood_level, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl, topOfConservationLevel, bottomOfConservationLevel, topOfFloodLevel, bottomOfFloodLevel) {
    return new Promise((resolve, reject) => {
        if (tsidStorage !== null) {
            const urlStorage = `${setBaseUrl}timeseries?name=${tsidStorage}&begin=${currentDateTimeMinus30Hours.toISOString()}&end=${currentDateTime.toISOString()}&office=${office}`;

            // console.log("urlStorage = ", urlStorage);
            fetch(urlStorage, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json;version=2'
                }
            })
                .then(response => {
                    if (!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json();
                })
                .then(stage => {
                    stage.values.forEach(entry => {
                        entry[0] = formatNWSDate(entry[0]);
                    });

                    const lastNonNullValue = getLastNonNullValue(stage);
                    let valueLast = null;
                    let timestampLast = null;

                    if (lastNonNullValue !== null) {
                        timestampLast = lastNonNullValue.timestamp;
                        valueLast = parseFloat(lastNonNullValue.value).toFixed(2);
                    }

                    const c_count = calculateCCount(tsidStorage);
                    const lastNonNull24HoursValue = getLastNonNull24HoursValue(stage, c_count);
                    let value24HoursLast = null;
                    let timestamp24HoursLast = null;

                    if (lastNonNull24HoursValue !== null) {
                        timestamp24HoursLast = lastNonNull24HoursValue.timestamp;
                        value24HoursLast = parseFloat(lastNonNull24HoursValue.value).toFixed(2);
                    }

                    const delta_24 = (valueLast !== null && value24HoursLast !== null)
                        ? (valueLast - value24HoursLast).toFixed(2)
                        : null;

                    if (valueLast > 0.0 && topOfConservationLevel > 0.0 && bottomOfConservationLevel >= 0.0) {
                        if (valueLast < bottomOfConservationLevel) {
                            conservationStorageValue = "0.00%";
                        } else if (valueLast > topOfConservationLevel) {
                            conservationStorageValue = "100.00%";
                        } else {
                            const total = (valueLast - bottomOfConservationLevel) / (topOfConservationLevel - bottomOfConservationLevel) * 100;
                            conservationStorageValue = total.toFixed(2) + "%";
                        }
                    } else {
                        conservationStorageValue = "%";
                    }

                    if (valueLast > 0.0 && topOfFloodLevel > 0.0 && bottomOfFloodLevel >= 0.0) {
                        if (valueLast < bottomOfFloodLevel) {
                            floodStorageValue = "0.00%";
                        } else if (valueLast > topOfFloodLevel) {
                            floodStorageValue = "100.00%";
                        } else {
                            const total = ((valueLast) - (bottomOfFloodLevel)) / ((topOfFloodLevel) - (bottomOfFloodLevel)) * 100;
                            floodStorageValue = total.toFixed(2) + "%";
                        }
                    } else {
                        floodStorageValue = "%";
                    }

                    stageTd.innerHTML = conservationStorageValue !== null ? conservationStorageValue : "-";
                    DeltaTd.innerHTML = floodStorageValue !== null ? floodStorageValue : "-";

                    resolve({ stageTd: conservationStorageValue, deltaTd: floodStorageValue });
                })
                .catch(error => {
                    console.error("Error fetching or processing data:", error);
                    reject(error);
                });
        } else {
            resolve({ stageTd: null, deltaTd: null });
        }
    });
}

/******************************************************************************
 *                            SUPPORT CDA FUNCTIONS                           *
 ******************************************************************************/
function filterByLocationCategory(array, category) {
    return array.filter(item =>
        item['location-category'] &&
        item['location-category']['office-id'] === category['office-id'] &&
        item['location-category']['id'] === category['id']
    );
}

function subtractHoursFromDate(date, hoursToSubtract) {
    return new Date(date.getTime() - (hoursToSubtract * 60 * 60 * 1000));
}

function plusHoursFromDate(date, hoursToSubtract) {
    return new Date(date.getTime() + (hoursToSubtract * 60 * 60 * 1000));
}

function addDaysToDate(date, days) {
    return new Date(date.getTime() + (days * 24 * 60 * 60 * 1000));
}

function formatTimestampToString(timestampLast) {
    const date = new Date(timestampLast);
    const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}-${date.getFullYear()} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
    return formattedDate;
}

function formatNWSDate(timestamp) {
    const date = new Date(timestamp);
    const mm = String(date.getMonth() + 1).padStart(2, '0'); // Month
    const dd = String(date.getDate()).padStart(2, '0'); // Day
    const yyyy = date.getFullYear(); // Year
    const hh = String(date.getHours()).padStart(2, '0'); // Hours
    const min = String(date.getMinutes()).padStart(2, '0'); // Minutes
    return `${mm}-${dd}-${yyyy} ${hh}:${min}`;
}

function extractValuesWithTimeNoon(values) {
    return values.filter(entry => {
        const timestamp = new Date(entry[0]);
        const hours = timestamp.getHours();
        const minutes = timestamp.getMinutes();
        return (hours === 7 || hours === 6) && minutes === 0; // Check if time is 13:00
    });
}

function calculateCCount(tsid) {
    // Split the string at the period
    const splitString = tsid.split('.');

    // Access the fifth element
    const forthElement = splitString[3];
    // console.log("forthElement = ", forthElement);

    // Initialize c_count variable
    let c_count;

    // Set c_count based on the value of firstTwoCharacters
    switch (forthElement) {
        case "15Minutes":
            c_count = 96;
            break;
        case "10Minutes":
            c_count = 144;
            break;
        case "30Minutes":
            c_count = 48;
            break;
        case "1Hour":
            c_count = 24;
            break;
        case "6Hours":
            c_count = 4;
            break;
        case "~2Hours":
            c_count = 12;
            break;
        case "5Minutes":
            c_count = 288;
            break;
        case "~1Day":
            c_count = 1;
            break;
        default:
            // Default value if forthElement doesn't match any case
            c_count = 0;
    }

    return c_count;
}

function generateDateTimeMidNightStringsISO(currentDateTime, currentDateTimePlus4Days) {
    // Convert current date and time to ISO string
    const currentDateTimeISO = currentDateTime.toISOString();
    // Extract the first 10 characters from the ISO string
    const first10CharactersDateTimeISO = currentDateTimeISO.substring(0, 10);

    // Get midnight in the Central Time zone
    const midnightCentral = new Date(currentDateTime.toLocaleDateString('en-US', { timeZone: 'America/Chicago' }));
    midnightCentral.setHours(0, 0, 0, 0); // Set time to midnight

    // Convert midnight to ISO string
    const midnightCentralISO = midnightCentral.toISOString();

    // Append midnight central time to the first 10 characters of currentDateTimeISO
    const currentDateTimeMidNightISO = first10CharactersDateTimeISO + midnightCentralISO.substring(10);

    // Convert currentDateTimePlus4Days to ISO string
    const currentDateTimePlus4DaysISO = currentDateTimePlus4Days.toISOString();
    // Extract the first 10 characters from the ISO string of currentDateTimePlus4Days
    const first10CharactersDateTimePlus4DaysISO = currentDateTimePlus4DaysISO.substring(0, 10);

    // Append midnight central time to the first 10 characters of currentDateTimePlus4DaysISO
    const currentDateTimePlus4DaysMidNightISO = first10CharactersDateTimePlus4DaysISO + midnightCentralISO.substring(10);

    return {
        currentDateTimeMidNightISO,
        currentDateTimePlus4DaysMidNightISO
    };
}

function getStationForLocation(locationId, riverMileObject) {
    // console.log("riverMileObject BEFORE function call:", JSON.stringify(riverMileObject, null, 2));
    // console.log("Type of riverMileObject:", typeof riverMileObject);
    // console.log("Is riverMileObject an array?", Array.isArray(riverMileObject));

    if (!Array.isArray(riverMileObject)) {
        // console.error("riverMileObject is not an array or is undefined/null", riverMileObject);
        return null;
    }

    for (const entry of riverMileObject) {
        // console.log("Processing entry:", JSON.stringify(entry, null, 2)); // Log full entry

        if (!entry || !entry["stream-location-node"]) {
            // console.warn("Skipping entry due to missing stream-location-node", entry);
            continue;
        }

        const name = entry["stream-location-node"]?.id?.name;
        // console.log("Location ID in entry:", name);

        if (name === locationId) {
            // console.log("Match found! Returning station:", entry["stream-location-node"]?.["stream-node"]?.station);
            return entry["stream-location-node"]?.["stream-node"]?.station || null;
        }
    }

    // console.log("No match found for locationId:", locationId);
    return null;
}

function formatTimestampToStringIOS(timestamp) {
    if (!timestamp) return "Invalid date";

    // Split the timestamp into date and time parts
    const [datePart, timePart] = timestamp.split(" ");
    const [day, month, year] = datePart.split("-").map(Number);
    const [hours, minutes] = timePart.split(":").map(Number);

    // Create a new Date object (Month is 0-based in JS)
    const dateObj = new Date(Date.UTC(year, month - 1, day, hours, minutes));

    if (isNaN(dateObj.getTime())) return "Invalid date";

    // Format as "YYYY-MM-DD HH:mm"
    return dateObj.toISOString().replace("T", " ").slice(0, 16);
}

/******************************************************************************
 *                           GET DATA FUNCTIONS                               *
 ******************************************************************************/
function getLastNonNullValue(data) {
    // Iterate over the values array in reverse
    for (let i = data.values.length - 1; i >= 0; i--) {
        // Check if the value at index i is not null
        if (data.values[i][1] !== null) {
            // Return the non-null value as separate variables
            return {
                timestamp: data.values[i][0],
                value: data.values[i][1],
                qualityCode: data.values[i][2]
            };
        }
    }
    // If no non-null value is found, return null
    return null;
}

function getLastNonNull24HoursValue(data, c_count) {
    let nonNullCount = 0;
    for (let i = data.values.length - 1; i >= 0; i--) {
        if (data.values[i][1] !== null) {
            nonNullCount++;
            if (nonNullCount > c_count) {
                return {
                    timestamp: data.values[i][0],
                    value: data.values[i][1],
                    qualityCode: data.values[i][2]
                };
            }
        }
    }
    return null;
}

function getLastNonNull6HoursValue(data, c_count) {
    let nonNullCount = 0;
    for (let i = data.values.length - 1; i >= 0; i--) {
        if (data.values[i][1] !== null) {
            nonNullCount++;
            if (nonNullCount > (c_count / 4)) {
                return {
                    timestamp: data.values[i][0],
                    value: data.values[i][1],
                    qualityCode: data.values[i][2]
                };
            }
        }
    }
    return null;
}

function getFirstNonNullValue(data) {
    // Iterate over the values array
    for (let i = 0; i < data.values.length; i++) {
        // Check if the value at index i is not null
        if (data.values[i][1] !== null) {
            // Return the non-null value as separate variables
            return {
                timestamp: data.values[i][0],
                value: data.values[i][1],
                qualityCode: data.values[i][2]
            };
        }
    }
    // If no non-null value is found, return null
    return null;
}

/******************************************************************************
 *                            CLASSES CDA FUNCTIONS                           *
 ******************************************************************************/
function determineStageClass(stage_value, flood_value) {
    // console.log("determineStageClass = ", stage_value + typeof (stage_value) + " " + flood_value + typeof (flood_value));
    var myStageClass;
    if (parseFloat(stage_value) >= parseFloat(flood_value)) {
        // console.log("determineStageClass = ", stage_value + " >= " + flood_value);
        myStageClass = "last_max_value_flood";
    } else {
        // console.log("Stage Below Flood Level");
        myStageClass = "last_max_value";
    }
    return myStageClass;
}

function determineDateTimeClass(formattedDate, currentDateTimeMinus2Hours) {
    var myDateTimeClass;
    if (formattedDate >= currentDateTimeMinus2Hours) {
        myDateTimeClass = "date_time_current";
    } else {
        // myDateTimeClass = "date_time_late";
        myDateTimeClass = "blinking-text";
    }
    return myDateTimeClass;
}

function determineDateTimeClassWaterQuality(formattedDate, currentDateTimeMinus2Hours, currentDateTimeMinus8Hours, label) {
    let myDateTimeClass;

    // Handle undefined or non-string labels
    if (!label || typeof label !== "string") {
        console.warn("Warning: Invalid or undefined label:", label);
        label = ""; // Assign an empty string to prevent `.includes()` errors
    }

    if (label.includes("LPMS")) {
        if (formattedDate >= currentDateTimeMinus8Hours) {
            myDateTimeClass = "date_time_current";
        } else {
            myDateTimeClass = "date_time_late";
        }
    } else {
        if (formattedDate >= currentDateTimeMinus2Hours) {
            myDateTimeClass = "date_time_current";
        } else {
            myDateTimeClass = "date_time_late";
        }
    }

    return myDateTimeClass;
}