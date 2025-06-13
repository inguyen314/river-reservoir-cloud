document.addEventListener('DOMContentLoaded', async function () {
    console.log("This is dev");

    let setReportDiv = null;
    setReportDiv = "river_reservoir";

    const loadingIndicator = document.getElementById(`loading_${setReportDiv}`);
    loadingIndicator.style.display = 'block';

    let setBaseUrl = null;
    if (cda === "internal") {
        setBaseUrl = `https://wm.${office.toLowerCase()}.ds.usace.army.mil/${office.toLowerCase()}-data/`;
    } else if (cda === "internal-coop") {
        setBaseUrl = `https://wm-${office.toLowerCase()}coop.mvk.ds.usace.army.mil/${office.toLowerCase()}-data/`;
    } else if (cda === "public") {
        setBaseUrl = `https://cwms-data.usace.army.mil/cwms-data/`;
    }
    console.log("setBaseUrl: ", setBaseUrl);

    // Set lakes location
    const lakeLocs = [
        "Lk Shelbyville-Kaskaskia",
        "Carlyle Lk-Kaskaskia",
        "Rend Lk-Big Muddy",
        "Wappapello Lk-St Francis",
        "Mark Twain Lk-Salt"
    ];

    // Get gage_control.json
    if (json === "true") {
        fetch(`json/gage_control_dev.json`)
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
                // const combinedDataRiver = structuredClone ? structuredClone(combinedData) : JSON.parse(JSON.stringify(combinedData));
                // const combinedDataReservoir = structuredClone ? structuredClone(combinedData) : JSON.parse(JSON.stringify(combinedData));
                const combinedDataRiver = JSON.parse(JSON.stringify(combinedData));
                const combinedDataReservoir = JSON.parse(JSON.stringify(combinedData));


                console.log('combinedDataRiver:', combinedDataRiver);
                console.log('combinedDataReservoir:', combinedDataReservoir);

                let tableRiver = null;
                let tableReservoir = null;
                if (type === "morning") {
                    tableRiver = createTableRiver(combinedDataRiver, type, day1, day2, day3, lakeLocs, setBaseUrl);
                } else {
                    tableRiver = createTableRiver(combinedDataRiver, type, day1, day2, day3, lakeLocs, setBaseUrl);
                    tableReservoir = createTableReservoir(combinedDataReservoir, type, day1, day2, day3, lakeLocs, setBaseUrl);
                }
                document.getElementById(`table_container_${setReportDiv}`).append(tableRiver, tableReservoir);
                // document.getElementById(`table_container_${setReportDiv}`).append(tableRiver);

                loadingIndicator.style.display = 'none';
            })
            .catch(error => {
                console.error('Error fetching data:', error);
            });
    } else {
        const setLocationCategory = "Basins";
        const setLocationGroupOwner = "River-Reservoir";
        const setTimeseriesGroup1 = "Stage";
        const setTimeseriesGroup2 = "Forecast-NWS"; // NWS next 3 days forecast
        const setTimeseriesGroup3 = "Crest"; // NWS Crest
        const setTimeseriesGroup4 = "Precip-Lake-Test"; // Precip
        const setTimeseriesGroup5 = "Consensus-Test"; // Yesterdays Inflow
        const setTimeseriesGroup6 = "Storage"; // Storage Utilized
        const setTimeseriesGroup7 = "Crest-Forecast-Lake"; //Pool Forecast
        const setTimeseriesGroup8 = "Outflow-Total-Lake-Test"; // Controlled Outflow
        const setTimeseriesGroup9 = "Gate-Total-Lake-Test"; // Controlled Outflow
        const setTimeseriesGroup10 = "Forecast-Lake"; // Lake Forecast
        const setTimeseriesGroup11 = "Outflow-Average-Lake-Test"; // Lake Forecast

        const categoryApiUrl = `${setBaseUrl}location/group?office=${office}&group-office-id=${office}&category-office-id=${office}&category-id=${setLocationCategory}`;

        // Maps
        const stageTsidMap = new Map();
        const metadataMap = new Map();
        const floodMap = new Map();
        const riverMileMap = new Map();
        const precipLakeTsidMap = new Map();
        const inflowYesterdayLakeTsidMap = new Map();
        const storageLakeTsidMap = new Map();
        const topOfFloodMap = new Map();
        const topOfConservationMap = new Map();
        const bottomOfFloodMap = new Map();
        const bottomOfConservationMap = new Map();
        const seasonalRuleCurveMap = new Map();
        const crestForecastLakeMap = new Map();
        const outflowTotalLakeMap = new Map();
        const gateTotalLakeMap = new Map();
        const forecastLakeMap = new Map();
        const recordStageMap = new Map();
        const forecastNwsTsidMap = new Map();
        const crestNwsTsidMap = new Map();
        const outflowAverageLakeMap = new Map();

        // Promises
        const stageTsidPromises = [];
        const metadataPromises = [];
        const floodPromises = [];
        const riverMilePromises = [];
        const precipLakeTsidPromises = [];
        const inflowYesterdayLakeTsidPromises = [];
        const storageLakeTsidPromises = [];
        const topOfFloodPromises = [];
        const topOfConservationPromises = [];
        const bottomOfFloodPromises = [];
        const bottomOfConservationPromises = [];
        const seasonalRuleCurvePromises = [];
        const crestForecastLakePromises = [];
        const outflowTotalLakePromises = [];
        const gateTotalLakePromises = [];
        const forecastLakePromises = [];
        const recordStagePromises = [];
        const forecastNwsTsidPromises = [];
        const crestNwsTsidPromises = [];
        const outflowAverageTsidPromises = [];

        const apiPromises = [];

        // Set empty data array to store gage_data.json
        let combinedData = [];

        // Fetch initial category
        fetch(categoryApiUrl)
            .then(validateResponse)
            .then(data => {
                const filteredArray = filterByLocationCategory(data, {
                    "office-id": office,
                    "id": setLocationCategory
                });

                const basins = filteredArray.map(item => item.id);
                if (basins.length === 0) {
                    console.warn('No basins found for the given category.');
                    return;
                }

                console.log('Filtered basins:', basins);

                basins.forEach(basin => {
                    const basinApiUrl = `${setBaseUrl}location/group/${basin}?office=${office}&category-id=${setLocationCategory}`;

                    apiPromises.push(
                        fetch(basinApiUrl)
                            .then(validateResponse)
                            .then(getBasin => {
                                if (!getBasin) return;

                                const locationIds = getBasin['assigned-locations'].map(loc => loc['location-id']);
                                return Promise.all(locationIds.map(id =>
                                    fetchAdditionalLocationGroupOwnerData(id, setBaseUrl, setLocationGroupOwner, office)
                                ))
                                    .then(results => {
                                        const result = results[0];

                                        getBasin['assigned-locations'] = getBasin['assigned-locations']
                                            .filter(loc => result?.['assigned-locations']?.some(r => r['location-id'] === loc['location-id']))
                                            .filter(loc => loc.attribute <= 900)
                                            .sort((a, b) => a.attribute - b.attribute);

                                        combinedData.push(getBasin);

                                        for (const location of getBasin['assigned-locations']) {
                                            if (lakeLocs.includes(location['location-id'])) {
                                                // For Lake Only
                                                fetchAndStoreDataForLakeLocation(location);
                                            } else {
                                                // For River Only
                                                fetchAndStoreDataForRiverLocation(location);
                                            }
                                        }
                                    });
                            })
                            .catch(err => console.error(`Fetch error for basin ${basin}:`, err))
                    );
                });

                return Promise.all(apiPromises);
            })
            .then(() => Promise.all([
                ...metadataPromises,
                ...floodPromises,
                ...stageTsidPromises,
                ...riverMilePromises,
                ...precipLakeTsidPromises,
                ...inflowYesterdayLakeTsidPromises,
                ...topOfFloodPromises,
                ...topOfConservationPromises,
                ...bottomOfFloodPromises,
                ...bottomOfConservationPromises,
                ...seasonalRuleCurvePromises,
                ...crestForecastLakePromises,
                ...outflowTotalLakePromises,
                ...gateTotalLakePromises,
                ...forecastLakePromises,
                ...recordStagePromises,
                ...forecastNwsTsidMap,
                ...crestNwsTsidPromises,
                ...outflowAverageTsidPromises
            ]))
            .then(() => {
                // Merge fetched data into locations
                combinedData.forEach(basin => {
                    basin['assigned-locations'].forEach(loc => {
                        loc.metadata = metadataMap.get(loc['location-id']);
                        loc.flood = floodMap.get(loc['location-id']);
                        loc['tsid-stage'] = stageTsidMap.get(loc['location-id']);
                        loc['river-mile'] = riverMileMap.get(loc['location-id']);
                        loc['tsid-lake-precip'] = precipLakeTsidMap.get(loc['location-id']);
                        loc['tsid-lake-inflow-yesterday'] = inflowYesterdayLakeTsidMap.get(loc['location-id']);
                        loc['tsid-lake-storage'] = storageLakeTsidMap.get(loc['location-id']);
                        loc['top-of-flood'] = topOfFloodMap.get(loc['location-id']);
                        loc['top-of-conservation'] = topOfConservationMap.get(loc['location-id']);
                        loc['bottom-of-flood'] = bottomOfFloodMap.get(loc['location-id']);
                        loc['bottom-of-conservation'] = bottomOfConservationMap.get(loc['location-id']);
                        loc['seasonal-rule-curve'] = seasonalRuleCurveMap.get(loc['location-id']);
                        loc['tsid-crest-forecast-lake'] = crestForecastLakeMap.get(loc['location-id']);
                        loc['tsid-outflow-total-lake'] = outflowTotalLakeMap.get(loc['location-id']);
                        loc['tsid-gate-total-lake'] = gateTotalLakeMap.get(loc['location-id']);
                        loc['tsid-forecast-lake'] = forecastLakeMap.get(loc['location-id']);
                        loc['record-stage'] = recordStageMap.get(loc['location-id']);
                        loc['tsid-nws-forecast'] = forecastNwsTsidMap.get(loc['location-id']);
                        loc['tsid-nws-crest'] = crestNwsTsidMap.get(loc['location-id']);
                        loc['tsid-outflow-average'] = outflowAverageLakeMap.get(loc['location-id']);
                    });
                });

                console.log('All combined data fetched:', combinedData);

                // Filter and sort
                combinedData.forEach(group => {
                    group['assigned-locations'] = group['assigned-locations']
                        .filter(loc => !loc.attribute.toString().endsWith('.1'))
                        .filter(loc => loc['tsid-stage']);
                });

                combinedData = combinedData.filter(group => group['assigned-locations'].length > 0);

                const sortOrder = ['Mississippi', 'Illinois', 'Cuivre', 'Missouri', 'Meramec', 'Ohio', 'Kaskaskia', 'Big Muddy', 'St Francis', 'Salt'];
                combinedData.sort((a, b) => {
                    const aIndex = sortOrder.indexOf(a.id);
                    const bIndex = sortOrder.indexOf(b.id);
                    return (aIndex === -1 ? 1 : aIndex) - (bIndex === -1 ? 1 : bIndex);
                });

                console.log('Final sorted combinedData:', combinedData);

                const formatDate = offset => {
                    const d = new Date();
                    d.setDate(d.getDate() + offset);
                    return `${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                };

                const [day1, day2, day3] = [1, 2, 3].map(formatDate);

                const combinedDataRiver = structuredClone?.(combinedData) || JSON.parse(JSON.stringify(combinedData));
                const combinedDataReservoir = structuredClone?.(combinedData) || JSON.parse(JSON.stringify(combinedData));

                const tableRiver = createTableRiver(combinedDataRiver, type, day1, day2, day3, lakeLocs, setBaseUrl);
                const tableReservoir = createTableReservoir(combinedDataReservoir, type, day1, day2, day3, lakeLocs, setBaseUrl);

                document.getElementById(`table_container_${setReportDiv}`).append(tableRiver, tableReservoir);
                loadingIndicator.style.display = 'none';
            })
            .catch(err => {
                console.error('Final processing error:', err);
                loadingIndicator.style.display = 'none';
            });

        // Helpers
        function validateResponse(response) {
            if (!response.ok) throw new Error(`Network error: ${response.status}`);
            return response.json();
        }

        function fetchAndStoreDataForRiverLocation(loc) {
            const locationId = loc['location-id'];
            const levelIdEffectiveDate = "2025-04-01T06:00:00Z";

            metadataPromises.push(
                fetch(`${setBaseUrl}locations/${locationId}?office=${office}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && metadataMap.set(locationId, data))
                    .catch(err => console.error(`Metadata fetch failed for ${locationId}:`, err))
            );

            const floodUrl = `${setBaseUrl}levels/${locationId}.Stage.Inst.0.Flood?office=${office}&effective-date=2024-01-01T08:00:00&unit=ft`;
            floodPromises.push(
                fetch(floodUrl)
                    .then(res => res.status === 404 ? null : res.ok ? res.json() : Promise.reject(`Flood fetch error: ${res.statusText}`))
                    .then(floodData => floodMap.set(locationId, floodData ?? null))
                    .catch(err => console.error(`Flood fetch failed for ${locationId}:`, err))
            );

            const tsidUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup1}?office=${office}&category-id=${locationId}`;
            stageTsidPromises.push(
                fetch(tsidUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && stageTsidMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const riverMileApiUrl = `${setBaseUrl}stream-locations?office-mask=${office}&name-mask=${loc['location-id']}`;
            riverMilePromises.push(
                fetch(riverMileApiUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && riverMileMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const levelIdRecordStage = `${loc['location-id']}.Stage.Inst.0.Record Stage`;
            const recordStageApiUrl = `${setBaseUrl}levels?level-id-mask=${levelIdRecordStage}&office=${office}`;
            recordStagePromises.push(
                fetch(recordStageApiUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && recordStageMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const tsidNwsForecastUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup2}?office=${office}&category-id=${locationId}`;
            forecastNwsTsidPromises.push(
                fetch(tsidNwsForecastUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && forecastNwsTsidMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const tsidNwsCrestUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup3}?office=${office}&category-id=${locationId}`;
            crestNwsTsidPromises.push(
                fetch(tsidNwsCrestUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && crestNwsTsidMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );
        }

        function fetchAndStoreDataForLakeLocation(loc) {
            const locationId = loc['location-id'];
            const levelIdEffectiveDate = "2025-04-01T06:00:00Z";

            metadataPromises.push(
                fetch(`${setBaseUrl}locations/${locationId}?office=${office}`)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && metadataMap.set(locationId, data))
                    .catch(err => console.error(`Metadata fetch failed for ${locationId}:`, err))
            );

            const floodUrl = `${setBaseUrl}levels/${locationId}.Stage.Inst.0.Flood?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ft`;
            floodPromises.push(
                fetch(floodUrl)
                    .then(res => res.status === 404 ? null : res.ok ? res.json() : Promise.reject(`Flood fetch error: ${res.statusText}`))
                    .then(floodData => floodMap.set(locationId, floodData ?? null))
                    .catch(err => console.error(`Flood fetch failed for ${locationId}:`, err))
            );

            const tsidUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup1}?office=${office}&category-id=${locationId}`;
            stageTsidPromises.push(
                fetch(tsidUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && stageTsidMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const precipLakeApiUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup4}?office=${office}&category-id=${loc['location-id']}`;
            precipLakeTsidPromises.push(
                fetch(precipLakeApiUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && precipLakeTsidMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const inflowYesterdayLakeApiUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup5}?office=${office}&category-id=${loc['location-id']}`;
            inflowYesterdayLakeTsidPromises.push(
                fetch(inflowYesterdayLakeApiUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => {
                        if (data) {
                            // console.log(`Fetched inflow data for ${locationId}:`, data);  // Log fetched data
                            inflowYesterdayLakeTsidMap.set(locationId, data);
                        } else {
                            // console.warn(`No inflow data returned for ${locationId}`);
                        }
                    })
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const storageLakeApiUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup6}?office=${office}&category-id=${loc['location-id']}`;
            storageLakeTsidPromises.push(
                fetch(storageLakeApiUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && storageLakeTsidMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const levelIdTopOfFlood = `${loc['location-id'].split('-')[0]}.Stor.Inst.0.Top of Flood`;
            const topOfFloodApiUrl = `${setBaseUrl}levels/${levelIdTopOfFlood}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ac-ft`;
            topOfFloodPromises.push(
                fetch(topOfFloodApiUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && topOfFloodMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const levelIdBottomOfFlood = `${loc['location-id'].split('-')[0]}.Stor.Inst.0.Bottom of Flood`;
            const bottomOfFloodApiUrl = `${setBaseUrl}levels/${levelIdBottomOfFlood}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ac-ft`;
            bottomOfFloodPromises.push(
                fetch(bottomOfFloodApiUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && bottomOfFloodMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const levelIdTopOfConservation = `${loc['location-id'].split('-')[0]}.Stor.Inst.0.Top of Conservation`;
            const topOfConservationApiUrl = `${setBaseUrl}levels/${levelIdTopOfConservation}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ac-ft`;
            topOfConservationPromises.push(
                fetch(topOfConservationApiUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && topOfConservationMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const levelIdBottomOfConservation = `${loc['location-id'].split('-')[0]}.Stor.Inst.0.Bottom of Conservation`;
            const bottomOfConservationApiUrl = `${setBaseUrl}levels/${levelIdBottomOfConservation}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ac-ft`;
            bottomOfConservationPromises.push(
                fetch(bottomOfConservationApiUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && bottomOfConservationMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const levelIdSeasonalRuleCurve = `${loc['location-id']}.Elev.Inst.0.Seasonal Rule Curve Production`;
            const seasonalRuleCurveApiUrl = `${setBaseUrl}levels/${levelIdSeasonalRuleCurve}?office=${office}&effective-date=${levelIdEffectiveDate}&unit=ft`;
            seasonalRuleCurvePromises.push(
                fetch(seasonalRuleCurveApiUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && seasonalRuleCurveMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const crestForecastLakeUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup7}?office=${office}&category-id=${loc['location-id']}`;
            crestForecastLakePromises.push(
                fetch(crestForecastLakeUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => {
                        if (data) {
                            // console.log(`Fetched data for ${locationId}:`, data);  // Log fetched data
                            crestForecastLakeMap.set(locationId, data);
                        } else {
                            // console.warn(`No data returned for ${locationId}`);
                        }
                    })
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const outflowTotalLakeUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup8}?office=${office}&category-id=${loc['location-id']}`;
            outflowTotalLakePromises.push(
                fetch(outflowTotalLakeUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => {
                        if (data) {
                            // console.log(`Fetched data for ${locationId}:`, data);  // Log fetched data
                            outflowTotalLakeMap.set(locationId, data);
                        } else {
                            // console.warn(`No data returned for ${locationId}`);
                        }
                    })
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const gateTotalLakeUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup9}?office=${office}&category-id=${loc['location-id']}`;
            gateTotalLakePromises.push(
                fetch(gateTotalLakeUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => {
                        if (data) {
                            // console.log(`Fetched data for ${locationId}:`, data);  // Log fetched data
                            gateTotalLakeMap.set(locationId, data);
                        } else {
                            // console.warn(`No data returned for ${locationId}`);
                        }
                    })
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const forecastLakeUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup10}?office=${office}&category-id=${loc['location-id']}`;
            forecastLakePromises.push(
                fetch(forecastLakeUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => {
                        if (data) {
                            // console.log(`Fetched data for ${locationId}:`, data);  // Log fetched data
                            forecastLakeMap.set(locationId, data);
                        } else {
                            // console.warn(`No data returned for ${locationId}`);
                        }
                    })
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const outflowAverageLakeUrl = `${setBaseUrl}timeseries/group/${setTimeseriesGroup11}?office=${office}&category-id=${loc['location-id']}`;
            outflowAverageTsidPromises.push(
                fetch(outflowAverageLakeUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => {
                        if (data) {
                            // console.log(`Fetched data for ${locationId}:`, data);  // Log fetched data
                            outflowAverageLakeMap.set(locationId, data);
                        } else {
                            // console.warn(`No data returned for ${locationId}`);
                        }
                    })
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );

            const levelIdRecordStage = `${loc['location-id']}.Stage.Inst.0.Record Stage`;
            const recordStageApiUrl = `${setBaseUrl}levels?level-id-mask=${levelIdRecordStage}&office=${office}`;
            recordStagePromises.push(
                fetch(recordStageApiUrl)
                    .then(res => res.ok ? res.json() : null)
                    .then(data => data && recordStageMap.set(locationId, data))
                    .catch(err => console.error(`TSID fetch failed for ${locationId}:`, err))
            );
        }
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

function getLastNonNull6amValue(data, tsid, c_count) {
    // console.log(data);

    if (!data || !Array.isArray(data.values)) {
        return {
            current6am: null,
            valueCountRowsBefore: null
        };
    }

    const parseTimestamp = (timestampStr) => {
        // Assumes input format: "MM-DD-YYYY HH:mm"
        const [datePart, timePart] = timestampStr.split(' ');
        const [month, day, year] = datePart.split('-');
        const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart.padStart(5, '0')}:00Z`;
        return new Date(isoString);
    };

    for (let i = data.values.length - 1; i >= 0; i--) {
        const [timestampStr, value, qualityCode] = data.values[i];
        const date = parseTimestamp(timestampStr);

        // Adjust for DST offset (in hours)
        const adjustedHours = (date.getUTCHours() + 0 + 24) % 24;
        const minutes = date.getUTCMinutes();

        if (adjustedHours === 6 && minutes === 0 && value !== null) {
            const result = {
                current6am: {
                    tsid,
                    timestamp: timestampStr,
                    value,
                    qualityCode
                },
                valueCountRowsBefore: null
            };

            if (i - c_count >= 0) {
                const [prevTs, prevVal, prevQual] = data.values[i - c_count];
                result.valueCountRowsBefore = {
                    tsid,
                    timestamp: prevTs,
                    value: prevVal,
                    qualityCode: prevQual
                };
            }

            return result;
        }
    }

    return {
        current6am: null,
        valueCountRowsBefore: null
    };
}

function getLastNonNullMidnightValue(data, tsid, c_count) {
    if (!data || !Array.isArray(data.values)) {
        return {
            current6am: null,
            valueCountRowsBefore: null
        };
    }

    const parseTimestamp = (timestampStr) => {
        // Assumes input format: "MM-DD-YYYY HH:mm"
        const [datePart, timePart] = timestampStr.split(' ');
        const [month, day, year] = datePart.split('-');
        const isoString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${timePart.padStart(5, '0')}:00Z`;
        return new Date(isoString);
    };

    for (let i = data.values.length - 1; i >= 0; i--) {
        const [timestampStr, value, qualityCode] = data.values[i];
        const date = parseTimestamp(timestampStr);

        // Adjust for DST offset
        const adjustedHours = (date.getUTCHours() + 0 + 24) % 24;
        const minutes = date.getUTCMinutes();

        // Check for midnight
        if (adjustedHours === 0 && minutes === 0 && value !== null) {
            const result = {
                current6am: {
                    tsid,
                    timestamp: timestampStr,
                    value,
                    qualityCode
                },
                valueCountRowsBefore: null
            };

            if (i - c_count >= 0) {
                const [prevTs, prevVal, prevQual] = data.values[i - c_count];
                result.valueCountRowsBefore = {
                    tsid,
                    timestamp: prevTs,
                    value: prevVal,
                    qualityCode: prevQual
                };
            }

            return result;
        }
    }

    return {
        current6am: null,
        valueCountRowsBefore: null
    };
}

function getDSTOffsetInHours() {
    // Get the current date
    const now = new Date();

    // Get the current time zone offset in minutes (with DST, if applicable)
    const currentOffset = now.getTimezoneOffset();

    // Convert the offset from minutes to hours
    const dstOffsetHours = currentOffset / 60;

    return dstOffsetHours; // Returns the offset in hours (e.g., -5 or -6)
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

function createTableRiver(combinedDataRiver, type, nws_day1_date_title, nws_day2_date_title, nws_day3_date_title, lakeLocs, setBaseUrl) {
    // Create a table element and set an ID for styling or selection purposes
    const table = document.createElement('table');
    table.setAttribute('id', 'webrep');

    // Get current date and time
    const currentDateTime = new Date();
    // console.log('currentDateTime:', currentDateTime);

    const currentDateTimeMinus2Hours = subtractHoursFromDate(currentDateTime, 2);
    const currentDateTimeMinus8Hours = subtractHoursFromDate(currentDateTime, 8);
    const currentDateTimeMinus30Hours = subtractHoursFromDate(currentDateTime, 30);
    const currentDateTimeMinus24Hours = subtractHoursFromDate(currentDateTime, 24);
    const currentDateTimeMinus60Hours = subtractHoursFromDate(currentDateTime, 60);
    const currentDateTimePlus30Hours = plusHoursFromDate(currentDateTime, 30);
    const currentDateTimePlus4Days = addDaysToDate(currentDateTime, 4);
    const currentDateTimePlus14Days = addDaysToDate(currentDateTime, 14);

    // Filter out locations not in lakeLocs, and remove basins without assigned-locations
    combinedDataRiver = combinedDataRiver.filter((basin) => {
        // Filter 'assigned-locations' within each basin
        basin['assigned-locations'] = basin['assigned-locations'].filter((location) => {
            const currentLocationId = location['location-id'];

            // Remove location if it is in lakeLocs
            return !lakeLocs.includes(currentLocationId);
        });

        // Remove the basin if it has no assigned locations left
        return basin['assigned-locations'].length > 0;
    });
    console.log("combinedDataRiver:", combinedDataRiver);

    // Add 3-rows title
    (() => {
        // TITLE ROW 1
        const headerRow = table.insertRow(0);

        // Define all columns
        const allColumns = ["River Mile", "Gage Station", "6am Level", "24hr Delta",
            "National Weather Service River Forecast", "Flood Level",
            "Gage Zero", "Record Stage", "Record Date"];

        // Define filtered columns if type is "morning"
        const columns = (type === "morning") ? allColumns.slice(0, 4) : allColumns;

        columns.forEach((columnName) => {
            const th = document.createElement('th');
            th.textContent = columnName;

            // Set row spans or column spans based on header requirements
            if (["River Mile", "Gage Station", "6am Level", "24hr Delta",
                "Flood Level", "Gage Zero", "Record Stage", "Record Date"].includes(columnName)) {
                th.rowSpan = 3;
            }

            if (columnName === "National Weather Service River Forecast") {
                th.colSpan = 6;
            }

            th.style.backgroundColor = 'darkblue';
            th.style.color = 'white';
            headerRow.appendChild(th);
        });

        // If not "morning", continue with additional header rows
        if (type !== "morning") {
            const headerRow2 = table.insertRow(1);

            let columns2 = null;
            if (isMobile === true) {
                columns2 = ["Next 3 days", "Forecast Date", "Crest", "Date"];
            } else {
                columns2 = ["Next 3 days", "Forecast Date Time", "Crest", "Date"];
            }
            columns2.forEach((columnName) => {
                const th = document.createElement('th');
                th.textContent = columnName;
                th.style.backgroundColor = 'darkblue';
                th.style.color = 'white';

                if (columnName === "Next 3 days") {
                    th.colSpan = 3;
                } else {
                    th.rowSpan = 2;
                }
                headerRow2.appendChild(th);
            });

            const headerRow3 = table.insertRow(2);
            const dayColumns = ["Day1", "Day2", "Day3"];

            dayColumns.forEach((day) => {
                const th = document.createElement('th');
                th.textContent = day;
                th.style.backgroundColor = 'darkblue';
                th.style.color = 'white';
                headerRow3.appendChild(th);
            });
        }
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

            // 01-River Mile
            (() => {
                const riverMileCell = document.createElement('td');
                const locationId = location['location-id'];
                const riverMileObject = location['river-mile'];
                const riverMileValue = getRiverMileForLocation(locationId, riverMileObject);
                riverMileCell.textContent = riverMileValue != null ? parseFloat(riverMileValue).toFixed(1) : "";
                row.appendChild(riverMileCell);
            })();

            // 02-Gage Station
            (() => {
                const locationCell = document.createElement('td');
                locationCell.textContent = location['metadata'][`public-name`];
                locationCell.style.whiteSpace = 'nowrap';
                row.appendChild(locationCell);
            })();

            // 03-Stage and 04-Delta
            (() => {
                const stageTd = document.createElement('td');
                const deltaTd = document.createElement('td');
                const floodValue = location['flood'] ? location['flood']['constant-value'] : null;
                const stageTsid = location?.['tsid-stage']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;
                if (stageTsid) {
                    fetchAndUpdateStageTd(stageTd, deltaTd, stageTsid, floodValue, currentDateTime, currentDateTimeMinus60Hours, setBaseUrl);
                }
                row.appendChild(stageTd);
                row.appendChild(deltaTd);
            })();

            if (type !== "morning") {
                // 05-Day1, 06-Day2, 07-Day3, 08-Forecast Time
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
                                const isValid1 = !isNaN(parseFloat(val1));
                                const isValid2 = !isNaN(parseFloat(val2));
                                const isValid3 = !isNaN(parseFloat(val3));

                                if (isValid1 && isValid2 && isValid3) {
                                    nwsDay1Td.textContent = parseFloat(val1).toFixed(2);
                                    nwsDay2Td.textContent = parseFloat(val2).toFixed(2);
                                    nwsDay3Td.textContent = parseFloat(val3).toFixed(2);
                                } else {
                                    nwsDay1Td.textContent = "--";
                                    nwsDay2Td.textContent = "--";
                                    nwsDay3Td.textContent = "--";
                                }
                            })
                            .catch(error => console.error("Failed to fetch NWS data:", error));
                    } else {
                        nwsDay1Td.textContent = "";
                        nwsDay2Td.textContent = "";
                        nwsDay3Td.textContent = "";
                    }

                    row.appendChild(nwsDay1Td);
                    row.appendChild(nwsDay2Td);
                    row.appendChild(nwsDay3Td);
                })();

                // 08-Nws Forecast Time
                (() => {
                    const nwsForecastTimeTd = document.createElement('td');
                    const nwsForecastTsid = location['tsid-nws-forecast']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                    if (nwsForecastTsid !== null) {
                        nwsForecastTimeTd.textContent = '-TBD-';
                        nwsForecastTimeTd.style.background = 'pink';
                    } else {
                        nwsForecastTimeTd.textContent = '';
                    }

                    row.appendChild(nwsForecastTimeTd);
                })();

                // 09-Crest Value and 10-Crest Date Time
                (() => {
                    const crestTd = document.createElement('td');
                    const crestDateTd = document.createElement('td');

                    const floodValue = location['flood'] ? location['flood']['constant-value'] : null;
                    const crestTsid = location?.['tsid-nws-crest']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                    if (crestTsid) {
                        fetchAndUpdateCrestTd(crestTd, crestDateTd, crestTsid, floodValue, currentDateTimeMinus30Hours, currentDateTimePlus14Days, setBaseUrl);
                    }

                    row.appendChild(crestTd);
                    row.appendChild(crestDateTd);
                })();

                // 11-Flood Level
                (() => {
                    const floodLevelCell = document.createElement('td');
                    const floodValue = location['flood'] ? location['flood']['constant-value'] : null;

                    if (floodValue != null && floodValue <= 900) {
                        floodLevelCell.textContent = floodValue.toFixed(2);
                    } else {
                        floodLevelCell.textContent = '';
                    }

                    row.appendChild(floodLevelCell);
                })();

                // 12-Gage Zero
                (() => {
                    // Create a new table cell for gage zero elevation
                    const gageZeroCell = document.createElement('td');

                    // Get the gage zero elevation value and vertical datum from location metadata
                    const gageZeroValue = location['metadata']?.['elevation'];
                    const datum = location['metadata']?.['vertical-datum'];

                    // Ensure gageZeroValue is a valid number before formatting
                    if (typeof gageZeroValue === 'number' && !isNaN(gageZeroValue)) {
                        gageZeroCell.textContent = (gageZeroValue > 900) ? '--' : gageZeroValue.toFixed(2);
                        gageZeroCell.title = 'NAVD88';
                    } else {
                        gageZeroCell.textContent = 'N/A';
                    }

                    // Highlight the cell and show a tooltip if the vertical datum is NGVD29
                    if (cda === "internal") {
                        if (datum === "NGVD29") {
                            gageZeroCell.style.color = 'purple';
                            gageZeroCell.title = 'NGVD29';
                        }
                    } else {
                        if (datum === "NGVD29") {
                            gageZeroCell.style.color = 'black';
                            gageZeroCell.title = 'NGVD29';
                        }
                    }

                    row.appendChild(gageZeroCell);
                })();

                // 13-Record Stage
                (() => {
                    const recordStageCell = document.createElement('td');
                    const levels = location['record-stage']?.['levels'];
                    const rawValue = Array.isArray(levels) && levels[0]?.['constant-value'] !== undefined
                        ? levels[0]['constant-value']
                        : null;

                    const recordStageValue = Number(rawValue);

                    // Check if recordStageValue is a valid number and within the required range
                    if (!isNaN(recordStageValue) && (recordStageValue * 3.28084) <= 900 && (recordStageValue * 3.28084) > 0) {
                        recordStageCell.textContent = (recordStageValue * 3.28084).toFixed(2);
                    } else {
                        recordStageCell.textContent = '';
                    }

                    row.appendChild(recordStageCell);
                })();

                // 14-Record Date
                (() => {
                    const recordDateTd = document.createElement('td');
                    const levels = location['record-stage']?.['levels'];
                    const recordDateValue = Array.isArray(levels) && levels[0]?.['level-date'] !== undefined
                        ? levels[0]['level-date']
                        : "";

                    let formattedRecordDateValue = "";

                    if (recordDateValue) {
                        const dateOnly = recordDateValue.split("T")[0];
                        const [year, month, day] = dateOnly.split("-");
                        formattedRecordDateValue = `${month}-${day}-${year}`;
                    }

                    recordDateTd.innerHTML = formattedRecordDateValue;
                    row.appendChild(recordDateTd);
                })();
            }

            table.appendChild(row);
        });
    });

    // Return the constructed table element
    return table;
}

function createTableReservoir(combinedDataReservoir, type, nws_day1_date_title, nws_day2_date_title, nws_day3_date_title, lakeLocs, setBaseUrl) {
    const table = document.createElement('table');
    table.setAttribute('id', 'webreplake');

    const today = new Date();
    today.setHours(0, 0, 0, 0); // Set to local midnight (DST-aware)

    const isoDateMinus7 = new Date(today); isoDateMinus7.setDate(today.getDate() - 7);
    const isoDateMinus6 = new Date(today); isoDateMinus6.setDate(today.getDate() - 6);
    const isoDateMinus5 = new Date(today); isoDateMinus5.setDate(today.getDate() - 5);
    const isoDateMinus4 = new Date(today); isoDateMinus4.setDate(today.getDate() - 4);
    const isoDateMinus3 = new Date(today); isoDateMinus3.setDate(today.getDate() - 3);
    const isoDateMinus2 = new Date(today); isoDateMinus2.setDate(today.getDate() - 2);
    const isoDateMinus1 = new Date(today); isoDateMinus1.setDate(today.getDate() - 1);

    const isoDateToday = new Date(today); // today at midnight

    const isoDatePlus1 = new Date(today); isoDatePlus1.setDate(today.getDate() + 1);
    const isoDatePlus2 = new Date(today); isoDatePlus2.setDate(today.getDate() + 2);
    const isoDatePlus3 = new Date(today); isoDatePlus3.setDate(today.getDate() + 3);
    const isoDatePlus4 = new Date(today); isoDatePlus4.setDate(today.getDate() + 4);
    const isoDatePlus5 = new Date(today); isoDatePlus5.setDate(today.getDate() + 5);
    const isoDatePlus6 = new Date(today); isoDatePlus6.setDate(today.getDate() + 6);
    const isoDatePlus7 = new Date(today); isoDatePlus7.setDate(today.getDate() + 7);

    // Add this to minus one hour. isoDatePlus1.setHours(isoDatePlus1.getHours() - 1);
    const isoDateTodayPlus6Hour = new Date(new Date(new Date().setHours(0, 0, 0, 0)).setHours(6));

    // Convert to ISO strings (UTC-based)
    const isoDateMinus7Str = isoDateMinus7.toISOString();
    const isoDateMinus6Str = isoDateMinus6.toISOString();
    const isoDateMinus5Str = isoDateMinus5.toISOString();
    const isoDateMinus4Str = isoDateMinus4.toISOString();
    const isoDateMinus3Str = isoDateMinus3.toISOString();
    const isoDateMinus2Str = isoDateMinus2.toISOString();
    const isoDateMinus1Str = isoDateMinus1.toISOString();
    const isoDateTodayStr = isoDateToday.toISOString();
    const isoDatePlus1Str = isoDatePlus1.toISOString();
    const isoDatePlus2Str = isoDatePlus2.toISOString();
    const isoDatePlus3Str = isoDatePlus3.toISOString();
    const isoDatePlus4Str = isoDatePlus4.toISOString();
    const isoDatePlus5Str = isoDatePlus5.toISOString();
    const isoDatePlus6Str = isoDatePlus6.toISOString();
    const isoDatePlus7Str = isoDatePlus7.toISOString();

    const isoDateTodayPlus6HoursStr = isoDateTodayPlus6Hour.toISOString();
    console.log("isoDateTodayPlus6HoursStr: ", isoDateTodayPlus6HoursStr);

    console.log("isoDateTodayStr: ", isoDateTodayStr);

    // Get current date and time
    const currentDateTime = new Date();
    const currentDateTimeIso = currentDateTime.toISOString();

    const currentDateTimeMinus2Hours = subtractHoursFromDate(currentDateTime, 2);
    const currentDateTimeMinus2HoursIso = currentDateTimeMinus2Hours.toISOString();

    const currentDateTimeMinus8Hours = subtractHoursFromDate(currentDateTime, 8);
    const currentDateTimeMinus8HoursIso = currentDateTimeMinus8Hours.toISOString();

    const currentDateTimeMinus30Hours = subtractHoursFromDate(currentDateTime, 30);
    const currentDateTimeMinus30HoursIso = currentDateTimeMinus30Hours.toISOString();

    const currentDateTimeMinus48Hours = subtractHoursFromDate(currentDateTime, 48);
    const currentDateTimeMinus48HoursIso = currentDateTimeMinus48Hours.toISOString();

    const currentDateTimeMinus60Hours = subtractHoursFromDate(currentDateTime, 60);
    const currentDateTimeMinus60HoursIso = currentDateTimeMinus60Hours.toISOString();

    const currentDateTimePlus30Hours = plusHoursFromDate(currentDateTime, 30);
    const currentDateTimePlus30HoursIso = currentDateTimePlus30Hours.toISOString();

    const currentDateTimeMinus24Hours = subtractHoursFromDate(currentDateTime, 24);
    const currentDateTimeMinus24HoursIso = currentDateTimeMinus24Hours.toISOString();

    const currentDateTimePlus1Day = addDaysToDate(currentDateTime, 1);
    const currentDateTimePlus1DayIso = currentDateTimePlus1Day.toISOString();

    const currentDateTimePlus4Days = addDaysToDate(currentDateTime, 4);
    const currentDateTimePlus4DaysIso = currentDateTimePlus4Days.toISOString();

    const currentDateTimePlus7Days = addDaysToDate(currentDateTime, 7);
    const currentDateTimePlus7DaysIso = currentDateTimePlus7Days.toISOString();

    const currentDateTimeMinus1Day = minusDaysToDate(currentDateTime, 1);
    const currentDateTimeMinus1DayIso = currentDateTimeMinus1Day.toISOString();

    console.log("currentDateTimeIso: ", currentDateTimeIso);

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
    console.log("combinedDataReservoir:", combinedDataReservoir);

    // Add 3-rows title
    (() => {
        // TITLE ROW 1
        // Create a table header row
        const headerRow = table.insertRow(0);

        // Create table headers for the desired columns
        const columns = ["Lake", "Midnight Level", "24hr Delta", "Storage Utilized", "Precip (in)", "Yesterdays Inflow (dsf)", "Controlled Outflow", "Seasonal Rule Curve", "Pool Forecast", "Record Stage", "Record Date"];

        columns.forEach((columnName) => {
            const th = document.createElement('th');
            th.textContent = columnName;
            if (["Lake", "Midnight Level", "24hr Delta", "Precip (in)", "Yesterdays Inflow (dsf)", "Seasonal Rule Curve", "Record Stage", "Record Date"].includes(columnName)) {
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
                const lakeValue = location['metadata'][`public-name`];
                lakeTd.textContent = lakeValue;
                lakeTd.style.whiteSpace = 'nowrap';
                row.appendChild(lakeTd);
            })();

            // 02 - Midnight Level
            (() => {
                const stageTd = document.createElement('td');
                const deltaTd = document.createElement('td');

                const floodValue = location['flood'] ? location['flood']['constant-value'] : null;
                const stageTsid = location?.['tsid-stage']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (stageTsid) {
                    fetchAndUpdateStageMidnightTd(stageTd, deltaTd, stageTsid, floodValue, currentDateTimeIso, currentDateTimeMinus60HoursIso, setBaseUrl);
                }

                row.appendChild(stageTd);
                row.appendChild(deltaTd);
            })();

            // 04-Consr and 05-Flood Storage
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

                const storageTsid = location?.['tsid-lake-storage']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (storageTsid) {
                    fetchAndUpdateStorageTd(ConsrTd, FloodTd, storageTsid, currentDateTimeIso, currentDateTimeMinus60HoursIso, setBaseUrl, topOfConservationLevel, bottomOfConservationLevel, topOfFloodLevel, bottomOfFloodLevel);
                } else {
                    ConsrTd.textContent = "--";
                    FloodTd.textContent = "--";
                }

                row.appendChild(ConsrTd);
                row.appendChild(FloodTd);
            })();

            // 06-Precip
            (() => {
                const precipTd = document.createElement('td');
                const precipLakeTsid = location?.['tsid-lake-precip']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (precipLakeTsid) {
                    fetchAndUpdatePrecipTd(precipTd, precipLakeTsid, currentDateTimeIso, currentDateTimeMinus24HoursIso, setBaseUrl);
                } else {
                    precipTd.textContent = "--";
                }

                row.appendChild(precipTd);
            })();

            // 07 - Yesterdays Inflow
            (() => {
                const yesterdayInflowTd = document.createElement('td');
                const yesterdayInflowTsid = location?.['tsid-lake-inflow-yesterday']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (yesterdayInflowTsid) {
                    fetchAndUpdateYesterdayInflowTd(yesterdayInflowTd, yesterdayInflowTsid, currentDateTimeMinus48Hours, currentDateTime, setBaseUrl);
                } else {
                    yesterdayInflowTd.textContent = "--";
                }

                row.appendChild(yesterdayInflowTd);
            })();

            // 08-Midnight Controlled Outflow and 09-Evening Controlled Outflow
            (() => {
                let midnightControlledOutflowTd = document.createElement('td');
                let eveningControlledOutflowTd = document.createElement('td');

                let lakeCurrent = location['metadata'][`public-name`];

                midnightControlledOutflowTd.textContent = null;
                eveningControlledOutflowTd.textContent = null;

                const outflowTotalLakeTsid = location?.['tsid-outflow-total-lake']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;
                const gateTotalLakeTsid = location?.['tsid-gate-total-lake']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;
                const forecastLakeTsid = location?.['tsid-forecast-lake']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;
                const outflowAverageLakeTsid = location?.['tsid-outflow-average']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (location['metadata'][`public-name`] === "Shelbyville Pool" || location['metadata'][`public-name`] === "Carlyle Pool") {
                    if (outflowTotalLakeTsid) {
                        fetchAndUpdateControlledOutflowTd(outflowTotalLakeTsid, isoDateTodayStr, isoDatePlus1Str, setBaseUrl)
                            .then(data => {
                                // console.log("Fetched outflowTotalLakeTsid data:", data);
                                const value = data?.values?.[0]?.[1];
                                midnightControlledOutflowTd.textContent = value !== null && value !== undefined ? value.toFixed(0) : "-M-";
                            })
                            .catch(error => {
                                console.error("Error during fetch:", error);
                            });
                    }
                }

                if (location['metadata'][`public-name`] === "Mark Twain Pool") {
                    if (forecastLakeTsid) {
                        fetchAndUpdateForecastTd(lakeCurrent, forecastLakeTsid, isoDateTodayStr, isoDatePlus1Str, isoDateTodayPlus6HoursStr, setBaseUrl, isoDateMinus1Str, midnightControlledOutflowTd)
                            .then(data => {
                                // console.log("Fetched forecastLakeTsid data:", data);
                                const value = data?.values?.[0]?.[1];
                                midnightControlledOutflowTd.textContent = value !== null && value !== undefined ? value.toFixed(0) : "-M-";

                            })
                            .catch(error => {
                                console.error("Error during fetch:", error);
                            });
                    }
                }

                if (location['metadata'][`public-name`] === "Wappapello Pool") {
                    if (gateTotalLakeTsid) {
                        fetchAndUpdateControlledOutflowTd(gateTotalLakeTsid, isoDateTodayStr, isoDatePlus1Str, setBaseUrl)
                            .then(data => {
                                // console.log("Fetched gateTotalLakeTsid data:", data);
                                const value = data?.values?.[0]?.[1];
                                midnightControlledOutflowTd.textContent = value !== null && value !== undefined ? value.toFixed(0) : "-M-";
                            })
                            .catch(error => {
                                console.error("Error during fetch:", error);
                            });
                    }
                }

                if (outflowAverageLakeTsid) {
                    fetchAndUpdateOutflowAverageTd(lakeCurrent, outflowAverageLakeTsid, isoDateTodayStr, isoDatePlus1Str, isoDateTodayPlus6HoursStr, setBaseUrl, isoDateMinus1Str)
                        .then(data => {
                            console.log("Fetched outflowAverageLakeTsid data:", data);
                            const rawValue = data?.values?.[0]?.[1];
                            const value = typeof rawValue === 'number' ? Math.round(rawValue / 10) * 10 : null;
                            console.log("value: ", value);
                            if (location['metadata'][`public-name`] === "Rend Pool") {
                                midnightControlledOutflowTd.textContent = value !== null && value !== undefined ? value.toFixed(0) : "-M-";
                            }
                        })
                        .catch(error => {
                            console.error("Error during fetch:", error);
                        });
                }


                if (forecastLakeTsid) {
                    fetchAndUpdateForecastTd(lakeCurrent, forecastLakeTsid, isoDateTodayStr, isoDatePlus1Str, isoDateTodayPlus6HoursStr, setBaseUrl, isoDateMinus1Str)
                        .then(data => {
                            // console.log("Fetched forecastLakeTsid data:", data);
                            const value = data?.values?.[0]?.[1];
                            // console.log("value: ", value);
                            eveningControlledOutflowTd.textContent = value !== null && value !== undefined ? value.toFixed(0) : "-M-";
                        })
                        .catch(error => {
                            console.error("Error during fetch:", error);
                        });
                }

                row.appendChild(midnightControlledOutflowTd);
                row.appendChild(eveningControlledOutflowTd);
            })();

            // 10-Seasonal Rule Curve
            (() => {
                const seasonalRuleCurveTd = document.createElement('td');
                // fetchAndLogSeasonalRuleCurveDataTd(location['location-id'], seasonalRuleCurveTd, setJsonFileBaseUrl);
                const seasonalRuleCurveValue = location['seasonal-rule-curve'][`constant-value`];
                if (seasonalRuleCurveValue) {
                    seasonalRuleCurveTd.textContent = seasonalRuleCurveValue.toFixed(2);
                } else {
                    seasonalRuleCurveTd.textContent = "--";
                }
                row.appendChild(seasonalRuleCurveTd);
            })();

            // 11 - Crest - Pool Forecast and 12 - Crest Date - Pool Forecast
            (() => {
                const crestPoolForecastTd = document.createElement('td');
                const datePoolForecastTd = document.createElement('td');

                const crestPoolForecastTsid = location?.['tsid-crest-forecast-lake']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                if (crestPoolForecastTsid) {
                    fetchAndUpdateCrestPoolForecastTd(crestPoolForecastTd, datePoolForecastTd, crestPoolForecastTsid, isoDateTodayStr, currentDateTimePlus7Days, setBaseUrl);
                } else {
                    crestPoolForecastTd.textContent = "--";
                    datePoolForecastTd.textContent = "--";
                }

                row.appendChild(crestPoolForecastTd);
                row.appendChild(datePoolForecastTd);
            })();

            // 13 - Record Stage
            (() => {
                // Create a new table cell for the record stage value
                const recordStageTd = document.createElement('td');

                // Prevent the cell content from wrapping to a new line
                recordStageTd.style.whiteSpace = 'nowrap';

                // Extract the 'constant-value' from the 'record-stage' object, if it exists
                const recordStageValue = location['record-stage']?.['levels'][0][`constant-value`];

                // Set the cell text content if the value is valid and less than or equal to 900
                recordStageTd.textContent = recordStageValue != null && (recordStageValue * 3.28084) <= 900
                    ? (recordStageValue * 3.28084).toFixed(2)
                    : '--';

                // Append the cell to the current row
                row.appendChild(recordStageTd);
            })();

            // 14 - Record Date
            (() => {
                const recordDateTd = document.createElement('td');
                const recordDateValue = location['record-stage']?.['levels'][0]['level-date'];

                let formattedRecordDateValue = "--";

                if (recordDateValue) {
                    const dateOnly = recordDateValue.split("T")[0];
                    const [year, month, day] = dateOnly.split("-");
                    formattedRecordDateValue = `${month}-${day}-${year}`;
                }

                recordDateTd.innerHTML = formattedRecordDateValue;
                row.appendChild(recordDateTd);
            })();

            table.appendChild(row);
        });
    });

    // Return the constructed table element
    return table;
}

function getRiverMileForLocation(locationId, riverMileObject) {
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

async function fetchAdditionalLocationGroupOwnerData(locationId, baseUrl, locationGroupOwner, office) {
    const additionalDataUrl = `${baseUrl}location/group/${locationGroupOwner}?office=${office}&category-id=${office}`;

    return fetch(additionalDataUrl, {
        method: 'GET'
    })
        .then(response => {
            if (!response.ok) {
                console.warn(`Response not ok for ${locationId}: Status ${response.status}`);
                return null;
            }
            return response.json();
        })
        .then(data => {
            if (data) {
                // console.log(`Fetched additional data for ${locationId}:`, data);
            }
            return data;
        })
        .catch(error => {
            console.error(`Error fetching additional data for ${locationId}:`, error);
            return null;
        });
}

/******************************************************************************
 *                               FETCH CDA FUNCTIONS                          *
 ******************************************************************************/

function fetchAndUpdateStageTd(stageTd, DeltaTd, tsidStage, flood_level, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl) {
    return new Promise((resolve, reject) => {
        if (!tsidStage) {
            stageTd.innerHTML = "<span class='missing'>-M-</span>";
            DeltaTd.innerHTML = "-";
            return resolve({ stageTd: null, deltaTd: null });
        }

        const urlStage = `${setBaseUrl}timeseries?name=${tsidStage}&begin=${currentDateTimeMinus30Hours.toISOString()}&end=${currentDateTime.toISOString()}&office=${office}`;

        fetch(urlStage, {
            method: 'GET',
            headers: {
                'Accept': 'application/json;version=2'
            }
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`HTTP error! Status: ${response.status}`);
                }
                return response.json();
            })
            .then(stage => {
                if (!stage || !Array.isArray(stage.values) || stage.values.length === 0) {
                    throw new Error("Invalid or empty stage data");
                }

                // console.log("stage: ", stage);

                stage.values.forEach(entry => {
                    entry[0] = formatNWSDate(entry[0]);
                });

                const c_count = calculateCCount(tsidStage);
                const lastNonNullValue = getLastNonNull6amValue(stage, stage.name, c_count);
                // console.log("lastNonNullValue: ", lastNonNullValue);

                let valueLast = null, timestampLast = null;
                if (lastNonNullValue?.current6am?.value != null) {
                    valueLast = parseFloat(lastNonNullValue.current6am.value).toFixed(2);
                    timestampLast = lastNonNullValue.current6am.timestamp;
                }

                let value24HoursLast = null, timestamp24HoursLast = null;
                if (lastNonNullValue?.valueCountRowsBefore?.value != null) {
                    value24HoursLast = parseFloat(lastNonNullValue.valueCountRowsBefore.value).toFixed(2);
                    timestamp24HoursLast = lastNonNullValue.valueCountRowsBefore.timestamp;
                }

                let delta_24 = "-";
                if (valueLast != null && value24HoursLast != null && !isNaN(valueLast) && !isNaN(value24HoursLast)) {
                    delta_24 = parseFloat(valueLast - value24HoursLast).toFixed(2);
                }

                let innerHTMLStage;
                if (valueLast == null || isNaN(valueLast)) {
                    innerHTMLStage = "<span class='missing'>-M-</span>";
                } else {
                    const floodClass = determineStageClass(valueLast, flood_level);
                    innerHTMLStage = `<span class='${floodClass}' title='${timestampLast}'>${valueLast}</span>`;
                }

                stageTd.innerHTML = innerHTMLStage;
                DeltaTd.innerHTML = delta_24;

                resolve({ stageTd: valueLast, deltaTd: delta_24 });
            })
            .catch(error => {
                console.error("Error fetching or processing stage data:", error);
                stageTd.innerHTML = "<span class='missing'>-M-</span>";
                DeltaTd.innerHTML = "-";
                reject(error);
            });
    });
}

function fetchAndUpdateCrestPoolForecastTd(stageTd, DeltaTd, tsidStage, isoDateTodayStr, currentDateTimePlus7Days, setBaseUrl) {
    function getTodayAtSixCentral() {
        const today = new Date();
        const utcOffset = today.getTimezoneOffset(); // Get the difference in minutes from UTC
        const centralOffset = -6 * 60; // Central Time is UTC-6 (during daylight saving time, it will be UTC-5)

        // Adjust if Daylight Saving Time is in effect (UTC-5)
        const isDST = (utcOffset === 300); // 300 minutes = UTC-5
        const offset = isDST ? -5 : -6;

        // Create a new Date object with the time adjusted for Central Time
        const centralTime = new Date(today);
        centralTime.setHours(6, 0, 0, 0); // Set the time to 06:00:00.000
        centralTime.setMinutes(centralTime.getMinutes() - (utcOffset + (offset * 60))); // Adjust to Central Time

        // Format the date in the required format
        const year = centralTime.getUTCFullYear();
        const month = String(centralTime.getUTCMonth() + 1).padStart(2, '0');
        const day = String(centralTime.getUTCDate()).padStart(2, '0');

        return `${year}-${month}-${day}T06:00:00.000Z`;
    }

    const dateAtSixCentral = getTodayAtSixCentral();
    // console.log(dateAtSixCentral);

    return new Promise((resolve, reject) => {
        if (tsidStage !== null) {
            const url = `${setBaseUrl}timeseries?name=${tsidStage}&begin=${isoDateTodayStr}&end=${currentDateTimePlus7Days.toISOString()}&office=${office}&version-date=${dateAtSixCentral}`;
            console.log("url = ", url);

            fetch(url, {
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
                .then(data => {
                    let valueLast = null;
                    let valueLastDate = null;
                    let qualityCodeLast = null;

                    if (
                        data &&
                        Array.isArray(data.values) &&
                        data.values.length > 0 &&
                        Array.isArray(data.values[0])
                    ) {
                        const rawStage = data.values[0][1];
                        const rawDate = data.values[0][0];
                        const qualityCode = data.values[0][2];

                        valueLast = isFinite(rawStage) ? Number(rawStage).toFixed(2) : '';
                        qualityCodeLast = isFinite(qualityCode) ? Number(qualityCode) : '';
                        valueLastDate = rawDate ? formatNWSDate(rawDate).split(' ')[0] : '';
                    }

                    if (qualityCodeLast === 5) {
                        stageTd.innerHTML = "Cresting";
                        DeltaTd.innerHTML = "";
                    } else if (qualityCodeLast === 9) {
                        stageTd.innerHTML = "Crested";
                        DeltaTd.innerHTML = "";
                    } else if (qualityCodeLast === 0) {
                        stageTd.innerHTML = "";
                        DeltaTd.innerHTML = "";
                    } else {
                        stageTd.innerHTML = valueLast;
                        DeltaTd.innerHTML = valueLastDate;
                    }

                    resolve({ stageTd: stageTd.innerHTML, deltaTd: DeltaTd.innerHTML });
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

function fetchAndUpdateStageMidnightTd(stageTd, DeltaTd, tsidStage, flood_level, currentDateTimeIso, currentDateTimeMinus60HoursIso, setBaseUrl) {
    return new Promise((resolve, reject) => {
        if (tsidStage !== null) {
            const urlStage = `${setBaseUrl}timeseries?name=${tsidStage}&begin=${currentDateTimeMinus60HoursIso}&end=${currentDateTimeIso}&office=${office}`;

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
                    // console.log("stage:", stage);

                    const c_count = calculateCCount(tsidStage);

                    const lastNonNullValue = getLastNonNullMidnightValue(stage, stage.name, c_count);
                    // console.log("lastNonNullValue:", lastNonNullValue);

                    let valueLast = null;
                    let timestampLast = null;

                    if (lastNonNullValue.current6am !== null) {
                        timestampLast = lastNonNullValue.current6am.timestamp;
                        valueLast = parseFloat(lastNonNullValue.current6am.value).toFixed(2);
                    }
                    // console.log("valueLast:", valueLast);
                    // console.log("timestampLast:", timestampLast);

                    let value24HoursLast = null;
                    let timestamp24HoursLast = null;

                    if (lastNonNullValue.valueCountRowsBefore !== null) {
                        timestamp24HoursLast = lastNonNullValue.valueCountRowsBefore.timestamp;
                        value24HoursLast = parseFloat(lastNonNullValue.valueCountRowsBefore.value).toFixed(2);
                    }

                    // console.log("value24HoursLast:", value24HoursLast);
                    // console.log("timestamp24HoursLast:", timestamp24HoursLast);

                    let delta_24 = null;

                    // Check if the values are numbers and not null/undefined
                    if (valueLast !== null && value24HoursLast !== null && !isNaN(valueLast) && !isNaN(value24HoursLast)) {
                        delta_24 = (valueLast - value24HoursLast).toFixed(2);
                    } else {
                        delta_24 = "--";  // or set to "-1" or something else if you prefer
                    }

                    // console.log("delta_24:", delta_24);

                    // Make sure delta_24 is a valid number before calling parseFloat
                    if (delta_24 !== "--" && delta_24 !== null && delta_24 !== undefined) {
                        delta_24 = parseFloat(delta_24).toFixed(2);
                    } else {
                        delta_24 = "--";
                    }

                    let innerHTMLStage;
                    if (valueLast === null) {
                        innerHTMLStage = "<span class='missing'>-M-</span>";
                    } else {
                        const floodClass = determineStageClass(valueLast, flood_level);
                        innerHTMLStage = `<span class='${floodClass}' title='${timestampLast}'>${valueLast}</span>`;
                    }

                    stageTd.innerHTML = innerHTMLStage;
                    DeltaTd.innerHTML = delta_24;

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
                headers: {
                    'Accept': 'application/json;version=2'
                }
            })
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                })
                .then(nws3Days => {
                    // console.log("nws3Days:", nws3Days);

                    nws3Days.values.forEach(entry => {
                        entry[0] = formatNWSDate(entry[0]);
                    });

                    // console.log("Formatted nws3Days:", nws3Days.values);

                    const valuesWithTimeNoon = extractValuesWithTimeNoon(nws3Days.values);
                    // console.log("Values at noon:", valuesWithTimeNoon);

                    const getFormattedValue = (arr, index) => {
                        const rawValue = arr?.[index]?.[1];
                        const parsedValue = parseFloat(rawValue);
                        return !isNaN(parsedValue) ? parsedValue.toFixed(2) : "-";
                    };

                    const firstMiddleValue = getFormattedValue(valuesWithTimeNoon, 1);
                    const secondMiddleValue = getFormattedValue(valuesWithTimeNoon, 2);
                    const thirdMiddleValue = getFormattedValue(valuesWithTimeNoon, 3);

                    // console.log("Extracted noon values:", {
                    //     nwsDay1Td: firstMiddleValue,
                    //     nwsDay2Td: secondMiddleValue,
                    //     nwsDay3Td: thirdMiddleValue
                    // });

                    resolve({
                        nwsDay1Td: firstMiddleValue,
                        nwsDay2Td: secondMiddleValue,
                        nwsDay3Td: thirdMiddleValue
                    });
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

function fetchAndUpdateCrestTd(td1, td2, tsid, flood, begin, end, setBaseUrl) {
    return new Promise((resolve, reject) => {
        if (tsid !== null) {
            const url = `${setBaseUrl}timeseries?name=${tsid}&begin=${begin.toISOString()}&end=${end.toISOString()}&office=${office}`;

            fetch(url, {
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
                .then(data => {
                    data.values.forEach(entry => {
                        entry[0] = formatNWSDate(entry[0]);
                    });

                    const lastNonNullValue = getLastNonNullValue(data);

                    let valueLast = null;
                    let timestampLast = null;
                    if (lastNonNullValue !== null) {
                        timestampLast = lastNonNullValue.timestamp;
                        valueLast = lastNonNullValue.value;
                    }

                    let innerHTMLCrest;
                    if (valueLast === null) {
                        innerHTMLCrest = "<span class='missing'>-TBD-</span>";
                        td1.style.background = 'pink';
                    } else {
                        const floodClass = determineStageClass(valueLast, flood);
                        innerHTMLCrest = `<span class='${floodClass}'>${valueLast.toFixed(2)}</span>`;
                    }

                    let innerHTMLCrestDate = null;
                    if (timestampLast === null) {
                        innerHTMLCrestDate = "<span class='missing'>-TBD-</span>";
                        td2.style.background = 'pink';
                    } else {
                        innerHTMLCrestDate = `<span>${timestampLast}</span>`;
                    } 

                    td1.innerHTML = innerHTMLCrest;
                    td2.innerHTML = innerHTMLCrestDate;

                    resolve({
                        stageTd: valueLast,
                        deltaTd: timestampLast
                    });
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

function fetchAndUpdatePrecipTd(precipTd, tsid, currentDateTimeIso, currentDateTimeMinus60HoursIso, setBaseUrl) {
    if (tsid !== null) {
        const urlPrecip = `${setBaseUrl}timeseries?name=${tsid}&begin=${currentDateTimeMinus60HoursIso}&end=${currentDateTimeIso}&office=${office}`;

        fetch(urlPrecip, {
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
            .then(precip => {
                precip.values.forEach(entry => {
                    entry[0] = formatNWSDate(entry[0]);
                });

                const lastNonNullPrecipValue = getLastNonNullValue(precip);

                if (lastNonNullPrecipValue !== null) {
                    var timestampPrecipLast = lastNonNullPrecipValue.timestamp;
                    var valuePrecipLast = parseFloat(lastNonNullPrecipValue.value).toFixed(2);
                    var qualityCodePrecipLast = lastNonNullPrecipValue.qualityCode;
                }

                const c_count = calculateCCount(tsid);

                const lastNonNull6HoursPrecipValue = getLastNonNull6HoursValue(precip, c_count);
                if (lastNonNull6HoursPrecipValue !== null) {
                    var timestampPrecip6HoursLast = lastNonNull6HoursPrecipValue.timestamp;
                    var valuePrecip6HoursLast = parseFloat(lastNonNull6HoursPrecipValue.value).toFixed(2);
                    var qualityCodePrecip6HoursLast = lastNonNull6HoursPrecipValue.qualityCode;
                }

                const lastNonNull24HoursPrecipValue = getLastNonNull24HoursValue(precip, c_count);
                if (lastNonNull24HoursPrecipValue !== null) {
                    var timestampPrecip24HoursLast = lastNonNull24HoursPrecipValue.timestamp;
                    var valuePrecip24HoursLast = parseFloat(lastNonNull24HoursPrecipValue.value).toFixed(2);
                    var qualityCodePrecip24HoursLast = lastNonNull24HoursPrecipValue.qualityCode;
                }

                const precip_delta_6 = (valuePrecipLast - valuePrecip6HoursLast).toFixed(2);
                const precip_delta_24 = (valuePrecipLast - valuePrecip24HoursLast).toFixed(2);

                const formattedLastValueTimeStamp = formatTimestampToStringIOS(timestampPrecipLast);
                const timeStampDateObject = new Date(timestampPrecipLast);
                const timeStampDateObjectMinus24Hours = new Date(timestampPrecipLast - (24 * 60 * 60 * 1000));

                let innerHTMLPrecip;
                if (lastNonNullPrecipValue === null) {
                    innerHTMLPrecip = "<span class='missing'>" + "-M-" + "</span>";
                } else {
                    innerHTMLPrecip = "<span class='last_max_value'>"
                        + valuePrecipLast
                        + "</span>";
                }
                return precipTd.innerHTML += innerHTMLPrecip;
            })
            .catch(error => {
                console.error("Error fetching or processing data:", error);
            });
    } else {
        return precipTd.innerHTML = "";
    }
}

function fetchAndUpdateYesterdayInflowTd(precipCell, tsid, begin, end, setBaseUrl) {
    if (tsid !== null) {
        // Fetch the time series data from the API using the determined query string
        const urlPrecip = `${setBaseUrl}timeseries?name=${tsid}&begin=${begin.toISOString()}&end=${end.toISOString()}&office=${office}`;
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
                        + "<span class='precip_missing'>"
                        + "-M-"
                        + "</span>";
                    + "</table>";
                } else {
                    innerHTMLPrecip = "<table id='precip'>"
                        // + "<span class='last_max_value' title='" + precip.name + ", Value = " + valuePrecipLast + ", Date Time = " + timestampPrecipLast + "'>"
                        + "<span class='last_max_value'>"
                        // + "<a href='../chart?office=" + office + "&cwms_ts_id=" + precip.name + "&lookback=4' target='_blank'>"
                        + valuePrecipLast
                        // + "</a>"
                        + "</span>";
                    + "</table>";
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

function fetchAndUpdateStorageTd(consrTd, floodTd, tsidStorage, currentDateTimeIso, currentDateTimeMinus60HoursIso, setBaseUrl, topOfConservationLevel, bottomOfConservationLevel, topOfFloodLevel, bottomOfFloodLevel) {
    return new Promise((resolve, reject) => {
        if (tsidStorage !== null) {
            const urlStorage = `${setBaseUrl}timeseries?name=${tsidStorage}&begin=${currentDateTimeMinus60HoursIso}&end=${currentDateTimeIso}&office=${office}`;

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

                    let dstOffsetHours = getDSTOffsetInHours();

                    const c_count = calculateCCount(tsidStorage);

                    const lastNonNullValue = getLastNonNullMidnightValue(stage, stage.name, c_count);

                    let valueLast = null;
                    let timestampLast = null;

                    if (lastNonNullValue !== null) {
                        timestampLast = lastNonNullValue.current6am.timestamp;
                        valueLast = parseFloat(lastNonNullValue.current6am.value).toFixed(2);
                    }

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

                    consrTd.innerHTML = conservationStorageValue !== null ? conservationStorageValue : "-";
                    floodTd.innerHTML = floodStorageValue !== null ? floodStorageValue : "-";

                    resolve({ consrTd: conservationStorageValue, floodTd: floodStorageValue });
                })
                .catch(error => {
                    console.error("Error fetching or processing data:", error);
                    reject(error);
                });
        } else {
            resolve({ consrTd: null, floodTd: null });
        }
    });
}

function fetchAndUpdateControlledOutflowTd(tsid, isoDateTodayStr, isoDatePlus1Str, setBaseUrl) {
    return new Promise((resolve, reject) => {
        if (tsid !== null) {
            const urlForecast = `${setBaseUrl}timeseries?name=${tsid}&begin=${isoDateTodayStr}&end=${isoDatePlus1Str}&office=${office}`;

            fetch(urlForecast, {
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
                .then(data => {
                    if (data?.values?.length) {
                        data.values.forEach(entry => {
                            entry[0] = formatNWSDate(entry[0]);
                        });
                    }
                    resolve(data);
                })
                .catch(error => {
                    console.error("Error fetching or processing data:", error);
                    reject(error);
                });
        } else {
            resolve(null);
        }
    });
}

function fetchAndUpdateForecastTd(lake, tsid, isoDateTodayStr, isoDatePlus1Str, isoDateTodayPlus6HoursStr, setBaseUrl, isoDateMinus1Str, midnightControlledOutflowTd) {
    return new Promise((resolve, reject) => {
        if (tsid !== null) {

            let urlForecast = null;
            if (lake === "Mark Twain Pool" && midnightControlledOutflowTd) {
                urlForecast = `${setBaseUrl}timeseries?name=${tsid}&begin=${isoDateMinus1Str}&end=${isoDateTodayStr}&office=${office}&version-date=${isoDateTodayPlus6HoursStr}`;
            } else {
                urlForecast = `${setBaseUrl}timeseries?name=${tsid}&begin=${isoDateTodayStr}&end=${isoDatePlus1Str}&office=${office}&version-date=${isoDateTodayPlus6HoursStr}`;
            }
            fetch(urlForecast, {
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
                .then(data => {
                    if (data?.values?.length) {
                        data.values.forEach(entry => {
                            entry[0] = formatNWSDate(entry[0]);
                        });
                    }
                    resolve(data);
                })
                .catch(error => {
                    console.error("Error fetching or processing data:", error);
                    reject(error);
                });
        } else {
            resolve(null);
        }
    });
}

function fetchAndUpdateOutflowAverageTd(lake, tsid, isoDateTodayStr, isoDatePlus1Str, isoDateTodayPlus6HoursStr, setBaseUrl, isoDateMinus1Str, midnightControlledOutflowTd) {
    return new Promise((resolve, reject) => {
        if (tsid !== null) {

            let urlOutflowAverage = null;
            urlOutflowAverage = `${setBaseUrl}timeseries?name=${tsid}&begin=${isoDateTodayStr}&end=${isoDateTodayStr}&office=${office}`;
            console.log("urlOutflowAverage = ", urlOutflowAverage);

            fetch(urlOutflowAverage, {
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
                .then(data => {
                    if (data?.values?.length) {
                        data.values.forEach(entry => {
                            entry[0] = formatNWSDate(entry[0]);
                        });
                    }
                    resolve(data);
                })
                .catch(error => {
                    console.error("Error fetching or processing data:", error);
                    reject(error);
                });
        } else {
            resolve(null);
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

function minusDaysToDate(date, days) {
    return new Date(date.getTime() - (days * 24 * 60 * 60 * 1000));
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
        const time = entry[0].split(' ')[1];
        return time === '13:00' || time === '12:00' || time === '11:00';
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

function getRiverMileForLocation(locationId, riverMileObject) {
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