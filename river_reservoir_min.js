document.addEventListener('DOMContentLoaded', async function () {
    const currentDateTime = new Date();

    // Report-specific configurations
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
    let setReportDiv = null;

    // Report Number configuration
    const reportNumber = 1;
    if (reportNumber === 1) {
        setReportDiv = "river_reservoir";
        setLocationCategory = "Basins"; // "River-Reservoir"
        setLocationGroupOwner = "River-Reservoir";
        setTimeseriesGroup1 = "Stage";
        setTimeseriesGroup2 = "Forecast-NWS";
        setTimeseriesGroup3 = "Crest";
        setTimeseriesGroup4 = "Precip-Lake";
        setTimeseriesGroup5 = "Inflow-Yesterday-Lake";
        setTimeseriesGroup6 = "Storage";
        setLookBack = subtractDaysFromDate(new Date(), 2);
        setLookForward = addDaysFromDate(new Date(), 14);
    }

    const loadingIndicator = document.getElementById(`loading_${setReportDiv}`);
    loadingIndicator.style.display = 'block';

    // Base URL configuration based on data access type (public/internal)
    let setBaseUrl = cda === "internal"
        ? `https://wm.${office.toLowerCase()}.ds.usace.army.mil:8243/${office.toLowerCase()}-data/`
        : `https://cwms-data.usace.army.mil/cwms-data/`;

    const categoryApiUrl = `${setBaseUrl}location/group?office=${office}&include-assigned=false&location-category-like=${setLocationCategory}`;

    // Initialize Maps to hold various datasets
    const metadataMap = new Map();
    const recordStageMap = new Map();
    const lwrpMap = new Map();
    const ownerMap = new Map();
    const stageTsidMap = new Map();
    const riverMileHardCodedMap = new Map();
    const riverMileMap = new Map();
    const forecastNwsTsidMap = new Map();
    const crestTsidMap = new Map();
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
    const ownerPromises = [];
    const stageTsidPromises = [];
    const riverMileHardCodedPromises = [];
    const riverMilePromises = [];
    const forecastNwsTsidPromises = [];
    const crestTsidPromises = [];
    const precipLakeTsidPromises = [];
    const inflowYesterdayLakeTsidPromises = [];
    const storageLakeTsidPromises = [];
    const topOfFloodPromises = [];
    const topOfConservationPromises = [];
    const bottomOfFloodPromises = [];
    const bottomOfConservationPromises = [];

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

            const apiPromises = [];
            let combinedData = [];

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

                    const ownerApiUrl = `${setBaseUrl}location/group/${setLocationGroupOwner}?office=${office}&category-id=${office}`;
                    ownerPromises.push(fetch(ownerApiUrl)
                        .then(response => response.ok ? response.json() : null)
                        .then(data => data && ownerMap.set(loc['location-id'], data))
                        .catch(error => console.error(`Error fetching owner for ${loc['location-id']}:`, error))
                    );

                    // For Rivers only
                    if (loc['location-id'] !== "Lk Shelbyville-Kaskaskia" || loc['location-id'] !== "Carlyle Lk-Kaskaskia" || loc['location-id'] !== "Rend Lk-Big Muddy" || loc['location-id'] !== "Wappapello Lk-St Francis" || loc['location-id'] !== "Mark Twain Lk-Salt") {
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

                        const riverMileApiUrl = `${setBaseUrl}stream-locations?office-mask=MVS`;
                        riverMilePromises.push(fetch(riverMileApiUrl)
                            .then(response => response.ok ? response.json() : null)
                            .then(data => data && riverMileMap.set(loc['location-id'], data))
                            .catch(error => console.error(`Error fetching river mile for ${loc['location-id']}:`, error))
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
                    }

                    // For Lakes only
                    if (loc['location-id'] === "Lk Shelbyville-Kaskaskia" || loc['location-id'] === "Carlyle Lk-Kaskaskia" || loc['location-id'] === "Rend Lk-Big Muddy" || loc['location-id'] === "Wappapello Lk-St Francis" || loc['location-id'] === "Mark Twain Lk-Salt") {
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
                    if (loc['location-id'] !== "Lk Shelbyville-Kaskaskia" || loc['location-id'] !== "Carlyle Lk-Kaskaskia" || loc['location-id'] !== "Rend Lk-Big Muddy" || loc['location-id'] !== "Wappapello Lk-St Francis" || loc['location-id'] !== "Mark Twain Lk-Salt") {
                        const forecastNwsApiUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup2}?office=${office}&category-id=${loc['location-id']}`;
                        forecastNwsTsidPromises.push(fetch(forecastNwsApiUrl)
                            .then(response => response.ok ? response.json() : null)
                            .then(data => data && forecastNwsTsidMap.set(loc['location-id'], data))
                            .catch(error => console.error(`Error fetching forecast NWS TSID for ${loc['location-id']}:`, error))
                        );

                        const crestApiUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup3}?office=${office}&category-id=${loc['location-id']}`;
                        crestTsidPromises.push(fetch(crestApiUrl)
                            .then(response => response.ok ? response.json() : null)
                            .then(data => data && crestTsidMap.set(loc['location-id'], data))
                            .catch(error => console.error(`Error fetching crest TSID for ${loc['location-id']}:`, error))
                        );
                    }

                    // For Lakes only
                    if (loc['location-id'] === "Lk Shelbyville-Kaskaskia" || loc['location-id'] === "Carlyle Lk-Kaskaskia" || loc['location-id'] === "Rend Lk-Big Muddy" || loc['location-id'] === "Wappapello Lk-St Francis" || loc['location-id'] === "Mark Twain Lk-Salt") {
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
                    ...topOfFloodPromises,
                    ...topOfConservationPromises,
                    ...bottomOfFloodPromises,
                    ...bottomOfConservationPromises,
                    ...riverMileHardCodedPromises,
                    ...riverMilePromises,
                    ...ownerPromises,
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
                                loc['top-of-flood'] = topOfFloodMap.get(loc['location-id']);
                                loc['top-of-conservation'] = topOfConservationMap.get(loc['location-id']);
                                loc['bottom-of-flood'] = bottomOfFloodMap.get(loc['location-id']);
                                loc['bottom-of-conservation'] = bottomOfConservationMap.get(loc['location-id']);
                                loc['river-mile-hard-coded'] = riverMileHardCodedMap.get(loc['location-id']);
                                loc['river-mile'] = riverMileMap.get(loc['location-id']);
                                loc['owner'] = ownerMap.get(loc['location-id']);
                                loc['tsid-stage'] = stageTsidMap.get(loc['location-id']);
                                loc['tsid-forecast-nws'] = forecastNwsTsidMap.get(loc['location-id']);
                                loc['tsid-crest'] = crestTsidMap.get(loc['location-id']);
                                loc['tsid-precip-lake'] = precipLakeTsidMap.get(loc['location-id']);
                                loc['tsid-inflow-yesterday-lake'] = inflowYesterdayLakeTsidMap.get(loc['location-id']);
                                loc['tsid-storage-lake'] = storageLakeTsidMap.get(loc['location-id']);
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
                        console.log('Removed locations with attribute ending in .1:', combinedData);

                        // Step 2: Remove locations without matching 'location-id' in owner's 'assigned-locations'
                        combinedData.forEach(dataGroup => {
                            dataGroup['assigned-locations'] = (dataGroup['assigned-locations'] || []).filter(location => {
                                const ownerLocs = location['owner']?.['assigned-locations'];
                                return ownerLocs && ownerLocs.some(ownerLoc => ownerLoc['location-id'] === location['location-id']);
                            });
                        });
                        console.log('Filtered locations by owner match:', combinedData);

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

                    const timeSeriesDataPromises = [];

                    for (const dataArray of combinedData) {
                        for (const locData of dataArray['assigned-locations'] || []) {
                            const timeSeriesMap = {
                                stage: locData['tsid-stage']?.['assigned-time-series'] || [],
                                forecastNws: locData['tsid-forecast-nws']?.['assigned-time-series'] || [],
                                crest: locData['tsid-crest']?.['assigned-time-series'] || [],
                                precipLake: locData['tsid-precip-lake']?.['assigned-time-series'] || [],
                                inflowYesterdayLake: locData['tsid-inflow-yesterday-lake']?.['assigned-time-series'] || [],
                                storageLake: locData['tsid-storage-lake']?.['assigned-time-series'] || [],
                            };

                            const fetchTimeSeriesDataPromises = (timeSeries, type) =>
                                timeSeries.map(series => {
                                    const tsid = series['timeseries-id'];
                                    const url = `${setBaseUrl}timeseries?page-size=5000&name=${tsid}&begin=${setLookBack.toISOString()}&end=${setLookForward.toISOString()}&office=${office}`;

                                    return fetch(url, { method: 'GET', headers: { 'Accept': 'application/json;version=2' } })
                                        .then(res => res.json())
                                        .then(data => {
                                            if (data.values) {
                                                data.values.forEach(entry => entry[0] = formatISODate2ReadableDate(entry[0]));
                                            }
                                            updateLocDataRiverReservoir(
                                                locData, type, data,
                                                getLastNonNullValueWithDelta24hrs(data, tsid),
                                                getNoonDataForDay1(data, tsid),
                                                getNoonDataForDay2(data, tsid),
                                                getNoonDataForDay3(data, tsid)
                                            );
                                        })
                                        .catch(error => console.error(`Error fetching data for ${locData['location-id']} TSID ${tsid}:`, error));
                                });

                            const extentsApiCall = async () => {
                                try {
                                    const url = `${setBaseUrl}catalog/TIMESERIES?page-size=5000&office=${office}`;
                                    const res = await fetch(url, { method: 'GET', headers: { 'Accept': 'application/json;version=2' } });
                                    const data = await res.json();
                                    locData['extents-api-data'] = data;
                                    locData['extents-data'] = {};

                                    const allTids = Object.values(timeSeriesMap).flat().map(series => series['timeseries-id']);
                                    allTids.forEach(tsid => {
                                        const entry = data.entries.find(e => e['name'] === tsid);
                                        if (entry) {
                                            const latestTimeCST = new Date(entry.extents[0]?.['latest-time']).toLocaleString('en-US', { timeZone: 'America/Chicago', month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
                                            const earliestTimeCST = new Date(entry.extents[0]?.['earliest-time']).toLocaleString('en-US', { timeZone: 'America/Chicago', month: '2-digit', day: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).replace(',', '');
                                            const extentKey = tsid.includes('Precip') ? 'precip' : tsid.includes('Stage') ? 'stage' : tsid.includes('Elev') ? 'elev' : tsid.includes('Flow') ? 'flow' : tsid.includes('Conc-DO') ? 'do' : tsid.includes('Stor') ? 'stor' : null;

                                            if (extentKey) {
                                                const extentData = { office: entry.office, name: entry.name, earliestTime: earliestTimeCST, latestTime: latestTimeCST, lastUpdate: entry.extents[0]?.['last-update'] };
                                                locData['extents-data'][extentKey] = locData['extents-data'][extentKey] ? [...locData['extents-data'][extentKey], extentData] : [extentData];
                                            }
                                        } else {
                                            console.warn(`No matching entry for TSID: ${tsid}`);
                                        }
                                    });
                                } catch (error) {
                                    console.error(`Error fetching extents data for ${locData['location-id']}:`, error);
                                }
                            };

                            timeSeriesDataPromises.push(
                                Promise.all([
                                    ...fetchTimeSeriesDataPromises(timeSeriesMap.stage, 'stage'),
                                    ...fetchTimeSeriesDataPromises(timeSeriesMap.forecastNws, 'forecast-nws'),
                                    ...fetchTimeSeriesDataPromises(timeSeriesMap.crest, 'crest'),
                                    ...fetchTimeSeriesDataPromises(timeSeriesMap.precipLake, 'precip-lake'),
                                    ...fetchTimeSeriesDataPromises(timeSeriesMap.inflowYesterdayLake, 'inflow-yesterday-lake'),
                                    ...fetchTimeSeriesDataPromises(timeSeriesMap.storageLake, 'storage-lake'),
                                    extentsApiCall()
                                ])
                            );
                        }
                    }

                    return Promise.all(timeSeriesDataPromises);
                })
                .then(() => {
                    console.log('All combinedData fetched successfully:', combinedData);

                    if (type === "morning") {
                        console.log("Calling morning report here.");

                        const tableRiver = createTableMorning(combinedData, type, reportNumber);
                        document.getElementById(`table_container_${setReportDiv}`).append(tableRiver);
                    } else {
                        console.log("Calling river reservoir report here.");

                        const formatDate = (daysToAdd) => {
                            const date = new Date();
                            date.setDate(date.getDate() + daysToAdd);
                            return ('0' + (date.getMonth() + 1)).slice(-2) + '-' + ('0' + date.getDate()).slice(-2);
                        };

                        const [day1, day2, day3] = [1, 2, 3].map(days => formatDate(days));
                        const combinedDataRiver = structuredClone ? structuredClone(combinedData) : JSON.parse(JSON.stringify(combinedData));
                        const combinedDataReservoir = structuredClone ? structuredClone(combinedData) : JSON.parse(JSON.stringify(combinedData));

                        const tableRiver = createTableRiver(combinedDataRiver, type, reportNumber, day1, day2, day3);
                        const tableReservoir = createTableReservoir(combinedDataReservoir, type, reportNumber, day1, day2, day3);

                        document.getElementById(`table_container_${setReportDiv}`).append(tableRiver, tableReservoir);
                    }
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

    console.log("combinedDataRiver before: ", combinedDataRiver);

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

    console.log("combinedDataRiver after: ", combinedDataRiver);

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
                const currentLevelCell = document.createElement('td');
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
                deltaCell.textContent = deltaValue != null ? parseFloat(deltaValue).toFixed(2) : '--';
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

                let conservationStorageValue = null;

                const storageLevel = (location['storage-lake-last-value'] && Array.isArray(location['storage-lake-last-value']) && location['storage-lake-last-value'][0]?.['value'])
                    ? location['storage-lake-last-value'][0]['value']
                    : null;
                // console.log("storageLevel: ", storageLevel);

                const topOfConservationLevel = location['top-of-conservation']?.['constant-value'] || null;
                // console.log("topOfConservationLevel: ", topOfConservationLevel);

                const bottomOfConservationLevel = location['bottom-of-conservation']?.['constant-value'] || null;
                // console.log("bottomOfConservationLevel: ", bottomOfConservationLevel);

                if (storageLevel > 0.0 && topOfConservationLevel > 0.0 && bottomOfConservationLevel >= 0.0) {
                    if (storageLevel < bottomOfConservationLevel) {
                        conservationStorageValue = "0.00%";
                    } else if (storageLevel > topOfConservationLevel) {
                        conservationStorageValue = "100.00%";
                    } else {
                        const total = (storageLevel - bottomOfConservationLevel) / (topOfConservationLevel - bottomOfConservationLevel) * 100;
                        conservationStorageValue = total.toFixed(2) + "%";
                    }
                } else {
                    conservationStorageValue = "%";
                }

                conservationStorageCell.innerHTML = conservationStorageValue;
                row.appendChild(conservationStorageCell);
            })();

            // 05 - Flood Storage
            (() => {
                const floodStorageCell = document.createElement('td');
                let floodStorageValue = null;

                const storageLevel = (location['storage-lake-last-value'] && Array.isArray(location['storage-lake-last-value']) && location['storage-lake-last-value'][0]?.['value'])
                    ? location['storage-lake-last-value'][0]['value']
                    : null;
                // console.log("storageLevel: ", storageLevel);

                const topOfFloodLevel = location['top-of-flood']?.['constant-value'] || null;
                // console.log("topOfFloodLevel: ", topOfFloodLevel);

                const bottomOfFloodLevel = location['bottom-of-flood']?.['constant-value'] || null;
                // console.log("bottomOfFloodLevel: ", bottomOfFloodLevel);

                if (storageLevel > 0.0 && topOfFloodLevel > 0.0 && bottomOfFloodLevel >= 0.0) {
                    if (storageLevel < bottomOfFloodLevel) {
                        floodStorageValue = "0.0%";
                    } else if (storageLevel > topOfFloodLevel) {
                        floodStorageValue = "100.0%";
                    } else {
                        const total = ((storageLevel) - (bottomOfFloodLevel)) / ((topOfFloodLevel) - (bottomOfFloodLevel)) * 100;
                        floodStorageValue = total.toFixed(1) + "%";
                    }
                } else {
                    floodStorageValue = "%";
                }

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
                fetchAndLogMidnightFlowData(location['location-id'], midnightControlledOutflowCell);
                midnightControlledOutflowCell.textContent = midnightControlledOutflowValue;
                row.appendChild(midnightControlledOutflowCell);
            })();

            // 09 - Evening - Controlled Outflow
            (() => {
                const eveningControlledOutflowCell = document.createElement('td');
                const eveningControlledOutflowValue = "--";
                fetchAndLogEveningFlowData(location['location-id'], eveningControlledOutflowCell);
                eveningControlledOutflowCell.textContent = eveningControlledOutflowValue;
                row.appendChild(eveningControlledOutflowCell);
            })();

            // 10 - Seasonal Rule Curve
            (() => {
                const seasonalRuleCurveCell = document.createElement('td');
                const seasonalRuleCurveValue = "--";
                fetchAndLogSeasonalRuleCurveData(location['location-id'], seasonalRuleCurveCell);
                seasonalRuleCurveCell.textContent = seasonalRuleCurveValue;
                row.appendChild(seasonalRuleCurveCell);
            })();

            // 11 - Crest - Pool Forecast
            (() => {
                const crestPoolForecastCell = document.createElement('td');
                const crestPoolForecastValue = "--";
                fetchAndLogPoolForecastData(location['location-id'], crestPoolForecastCell);
                crestPoolForecastCell.textContent = crestPoolForecastValue;
                row.appendChild(crestPoolForecastCell);
            })();

            // 12 - Date - Pool Forecast
            (() => {
                const datePoolForecastCell = document.createElement('td');
                const datePoolForecastValue = "--";
                fetchAndLogPoolForecastDateData(location['location-id'], datePoolForecastCell);
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

                // const recordStage = location['record-stage'];
                // const recordStageDate = recordStage ? recordStage['level-date'] : null;
                // Check if recordStageDate is valid and within the required range
                // recordDateCell.textContent = recordStageDate != null
                //     ? recordStageDate
                //     : '';

                const recordDateValue = location['river-mile-hard-coded'] && location['river-mile-hard-coded']['record_stage_date_hard_coded'];
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

function createTableMorning(combinedDataRiver, type, reportNumber, nws_day1_date_title, nws_day2_date_title, nws_day3_date_title) {
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
                const currentLevelCell = document.createElement('td');
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