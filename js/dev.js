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
        const setTimeseriesGroup4 = "Precip-Lake-Test";
        const setTimeseriesGroup5 = "Inflow-Yesterday-Lake";

        const categoryApiUrl = `${setBaseUrl}location/group?office=${office}&group-office-id=${office}&category-office-id=${office}&category-id=${setLocationCategory}`;

        // Maps
        const stageTsidMap = new Map();
        const metadataMap = new Map();
        const floodMap = new Map();
        const riverMileMap = new Map();
        const precipLakeTsidMap = new Map();
        const inflowYesterdayLakeTsidMap = new Map();

        // Promises
        const stageTsidPromises = [];
        const metadataPromises = [];
        const floodPromises = [];
        const riverMilePromises = [];
        const precipLakeTsidPromises = [];
        const inflowYesterdayLakeTsidPromises = [];
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
            .then(() => Promise.all([...metadataPromises, ...floodPromises, ...stageTsidPromises, ...riverMilePromises, ...precipLakeTsidPromises]))
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
        }

        function fetchAndStoreDataForLakeLocation(loc) {
            const locationId = loc['location-id'];

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
                    .then(data => data && inflowYesterdayLakeTsidMap.set(locationId, data))
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

function getLastNonNull6amValue(data, tsid, dstOffsetHours, c_count) {
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

function getLastNonNullMidnightValue(data, tsid, dstOffsetHours, c_count) {
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
                const riverMileValue = getStationForLocation(locationId, riverMileObject);
                riverMileCell.textContent = riverMileValue != null ? parseFloat(riverMileValue).toFixed(1) : "--";
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
                    fetchAndUpdateStageTd(stageTd, deltaTd, stageTsid, floodValue, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl);
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
                        fetchAndUpdateNwsForecastTd(
                            stageTsid,
                            nwsForecastTsid,
                            floodValue,
                            currentDateTime,
                            currentDateTimePlus4Days,
                            setBaseUrl
                        )
                            .then(({ nwsDay1Td: val1, nwsDay2Td: val2, nwsDay3Td: val3 }) => {
                                // console.log("NWS forecast values:", val1, val2, val3);
                                nwsDay1Td.textContent = val1 && !isNaN(parseFloat(val1)) ? parseFloat(val1).toFixed(2) : "--";
                                nwsDay2Td.textContent = val2 && !isNaN(parseFloat(val2)) ? parseFloat(val2).toFixed(2) : "--";
                                nwsDay3Td.textContent = val3 && !isNaN(parseFloat(val3)) ? parseFloat(val3).toFixed(2) : "--";
                            })
                            .catch(error => console.error("Failed to fetch NWS data:", error));
                    } else {
                        nwsDay1Td.textContent = "--";
                        nwsDay2Td.textContent = "--";
                        nwsDay3Td.textContent = "--";
                    }

                    row.appendChild(nwsDay1Td);
                    row.appendChild(nwsDay2Td);
                    row.appendChild(nwsDay3Td);
                })();

                // 08-Nws Forecast Time PHP
                (() => {
                    const nwsForecastTimeTd = document.createElement('td');
                    const nwsForecastTsid = location['tsid-nws-forecast']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                    if (nwsForecastTsid !== null) {
                        nwsForecastTimeTd.textContent = '--';
                        // fetchAndLogNwsData(nwsForecastTsid, nwsForecastTimeTd, setJsonFileBaseUrl, isMobile);
                    } else {
                        nwsForecastTimeTd.textContent = '--';
                    }

                    row.appendChild(nwsForecastTimeTd);
                })();

                // 09-Crest Value and 10-Crest Date Time
                (() => {
                    const crestTd = document.createElement('td');
                    const crestDateTd = document.createElement('td');

                    const floodValue = location['flood'] ? location['flood']['constant-value'] : null;
                    const crestTsid = location?.['tsid-nws-crest']?.['assigned-time-series']?.[0]?.['timeseries-id'] ?? null;

                    if (floodValue !== null && crestTsid !== null) {
                        crestTd.textContent = '--';
                    } else {
                        crestTd.textContent = '--';
                    }

                    if (floodValue !== null && crestTsid !== null) {
                        crestDateTd.textContent = '--';
                    } else {
                        crestDateTd.textContent = '--';
                    }

                    // Use PHP
                    // fetchAndLogNwsCrestData(crestTsid, crestTd, crestDateTd);

                    // Use CDA
                    // if (crestTsid) {
                    //     fetchAndUpdateCrestTd(crestTd, crestDateTd, crestTsid, floodValue, currentDateTimeMinus2Hours, currentDateTimePlus14Days, currentDateTimeMinus30Hours, setBaseUrl);
                    // }

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
                        floodLevelCell.textContent = '--';
                    }

                    row.appendChild(floodLevelCell);
                })();

                // 12 - Gage Zero
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
                    const recordStage = location['record-stage'];
                    const recordStageValue = recordStage ? recordStage['constant-value'] : null;

                    // Check if recordStageValue is valid and within the required range
                    if (recordStageValue != null && recordStageValue <= 900) {
                        recordStageCell.textContent = recordStageValue.toFixed(2);
                    } else {
                        recordStageCell.textContent = '--';
                    }

                    row.appendChild(recordStageCell);
                })();

                // 14-Record Date
                (() => {
                    const recordDateCell = document.createElement('td');
                    const recordDateValue = (location['river-mile-hard-coded'] && location['river-mile-hard-coded']['record_stage_date_hard_coded']);
                    const formattedRecordDateValue = recordDateValue != null ? recordDateValue.replace(/-/g, '&#8209;') : "";

                    if (formattedRecordDateValue) {
                        recordDateCell.innerHTML = formattedRecordDateValue;
                    } else {
                        recordDateCell.innerHTML = "--";
                    }

                    recordDateCell.title = "--";
                    recordDateCell.className = 'hard_coded';

                    row.appendChild(recordDateCell);
                })();
            }

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

    // console.log("lakeLocs: ", lakeLocs);
    // console.log("combinedDataReservoir (before): ", combinedDataReservoir);

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
                    fetchAndUpdateStageMidnightTd(stageTd, deltaTd, stageTsid, floodValue, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl);
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
                    fetchAndUpdatePrecipTd(precipTd, precipLakeTsid, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl);
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
                    fetchAndUpdateYesterdayInflowTd(yesterdayInflowTd, yesterdayInflowTsid, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl);
                } else {
                    yesterdayInflowTd.textContent = "--";
                }

                row.appendChild(yesterdayInflowTd);
            })();

            // 08 - Midnight - Controlled Outflow
            (() => {
                const midnightControlledOutflowTd = document.createElement('td');
                const midnightControlledOutflowValue = "--";
                // fetchAndLogMidnightFlowDataTd(location['location-id'], midnightControlledOutflowTd, setJsonFileBaseUrl);
                midnightControlledOutflowTd.textContent = midnightControlledOutflowValue;
                row.appendChild(midnightControlledOutflowTd);
            })();

            // 09 - Evening - Controlled Outflow
            (() => {
                const eveningControlledOutflowTd = document.createElement('td');
                const eveningControlledOutflowValue = "--";
                // fetchAndLogEveningFlowDataTd(location['location-id'], eveningControlledOutflowTd, setJsonFileBaseUrl);
                eveningControlledOutflowTd.textContent = eveningControlledOutflowValue;
                row.appendChild(eveningControlledOutflowTd);
            })();

            // 10 - Seasonal Rule Curve
            (() => {
                const seasonalRuleCurveTd = document.createElement('td');
                const seasonalRuleCurveValue = "--";
                // fetchAndLogSeasonalRuleCurveDataTd(location['location-id'], seasonalRuleCurveTd, setJsonFileBaseUrl);
                seasonalRuleCurveTd.textContent = seasonalRuleCurveValue;
                row.appendChild(seasonalRuleCurveTd);
            })();

            // 11 - Crest - Pool Forecast
            (() => {
                const crestPoolForecastTd = document.createElement('td');
                const crestPoolForecastValue = "--";
                // fetchAndLogPoolForecastDataTd(location['location-id'], crestPoolForecastTd, setJsonFileBaseUrl);
                crestPoolForecastTd.textContent = crestPoolForecastValue;
                row.appendChild(crestPoolForecastTd);
            })();

            // 12 - Date - Pool Forecast Date
            (() => {
                const datePoolForecastTd = document.createElement('td');
                const datePoolForecastValue = "--";
                // fetchAndLogPoolForecastDateDataTd(location['location-id'], datePoolForecastTd, setJsonFileBaseUrl);
                datePoolForecastTd.textContent = datePoolForecastValue;
                row.appendChild(datePoolForecastTd);
            })();

            // 13 - Record Stage
            (() => {
                // Create a new table cell for the record stage value
                const recordStageTd = document.createElement('td');

                // Prevent the cell content from wrapping to a new line
                recordStageTd.style.whiteSpace = 'nowrap';

                // Extract the 'constant-value' from the 'record-stage' object, if it exists
                const recordStageValue = location['record-stage']?.['constant-value'];

                // Set the cell text content if the value is valid and less than or equal to 900
                recordStageTd.textContent = recordStageValue != null && recordStageValue <= 900
                    ? recordStageValue.toFixed(2)
                    : '--';

                // Append the cell to the current row
                row.appendChild(recordStageTd);
            })();

            // 14 - Record Date
            (() => {
                const recordDateTd = document.createElement('td');
                const recordDateValue = location['river-mile-hard-coded'] && location['river-mile-hard-coded']['record_stage_date_hard_coded'];

                const formattedRecordDateValue = recordDateValue != null ? recordDateValue.replace(/-/g, '&#8209;') : "";

                if (recordDateValue) {
                    recordDateTd.innerHTML = formattedRecordDateValue;
                } else {
                    recordDateTd.innerHTML = "--";
                }

                recordDateTd.title = "Json";
                recordDateTd.className = 'hard_coded';

                row.appendChild(recordDateTd);
            })();

            table.appendChild(row);
        });
    });

    // Return the constructed table element
    return table;
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

function filterDataByTsid(NwsOutput, cwms_ts_id) {
    const filteredData = NwsOutput.filter(item => {
        return item !== null && item.cwms_ts_id_day1 === cwms_ts_id;
    });

    return filteredData;
}

function updateNwsForecastTimeHTML(filteredData, forecastTimeCell, isMobile) {
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
    const displayDateTime = isMobile ? formattedDateTime.slice(0, 8) : formattedDateTime;

    forecastTimeCell.style.whiteSpace = 'nowrap';

    // Update the HTML content
    forecastTimeCell.innerHTML = `<div class="hard_coded_php" title="Uses PHP exportNwsForecasts2Json.json Output, No Cloud Option Yet">${displayDateTime}</div>`;

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

async function fetchDataFromROutput(setJsonFileBaseUrl) {
    let url = null;
    url = setJsonFileBaseUrl + 'php_data_api/public/json/outputR.json';
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

function updateFlowMidnightHTML(filteredData, midnightCell) {
    const locationData = filteredData[Object.keys(filteredData)[0]]; // Get the first (and only) key's data
    midnightCell.innerHTML = `<div class="hard_coded_php" title="outflow_midnight">${locationData.outflow_midnight}</div>`;
}

function updateFlowEveningHTML(filteredData, eveningCell) {
    const locationData = filteredData[Object.keys(filteredData)[0]]; // Get the first (and only) key's data
    eveningCell.innerHTML = `<div class="hard_coded_php" title="outflow_evening">${locationData.outflow_evening}</div>`;
}

function updateRuleCurveHTML(filteredData, seasonalRuleCurveCell) {
    const locationData = filteredData[Object.keys(filteredData)[0]]; // Get the first (and only) key's data
    seasonalRuleCurveCell.innerHTML = `<div class="hard_coded_php" title="rule_curve">${(parseFloat(locationData.rule_curve)).toFixed(2)}</div>`;
}

function updateLakeCrestHTML(filteredData, crestCell) {
    const locationData = filteredData[Object.keys(filteredData)[0]]; // Get the first (and only) key's data
    if (locationData.crest || locationData.option === "CG") {
        const isCresting = locationData.option === "CG";
        const crestText = isCresting ? "Cresting" : `${locationData.option} ${locationData.crest}`;
        crestCell.innerHTML = `<div class="hard_coded_php" title="crest">${crestText}</div>`;
        crestCell.style.whiteSpace = 'nowrap'; // Prevent line break
    } else {
        crestCell.innerHTML = `<div class="hard_coded_php" title="crest"></div>`;
    }
}

function updateLakeCrestDateHTML(filteredData, crestDateCell) {
    const locationData = filteredData[Object.keys(filteredData)[0]]; // Get the first (and only) key's data
    if (locationData.crest && locationData.crest_date_time) {
        crestDateCell.innerHTML = `<div class="hard_coded_php" style="white-space: nowrap;" title="crest_date_time">${locationData.crest_date_time.slice(0, 5)}</div>`;
    } else {
        crestDateCell.innerHTML = `<div class="hard_coded_php" style="white-space: nowrap;" title="crest_date_time"></div>`;
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
                    // console.log("stage:", stage);

                    let dstOffsetHours = getDSTOffsetInHours();
                    // console.log("dstOffsetHours:", dstOffsetHours);

                    const c_count = calculateCCount(tsidStage);

                    const lastNonNullValue = getLastNonNull6amValue(stage, stage.name, dstOffsetHours, c_count);
                    // console.log("lastNonNullValue:", lastNonNullValue);

                    let valueLast = null;
                    let timestampLast = null;

                    if (lastNonNullValue !== null) {
                        timestampLast = lastNonNullValue.current6am.timestamp;
                        valueLast = parseFloat(lastNonNullValue.current6am.value).toFixed(2);
                    }
                    // console.log("valueLast:", valueLast);
                    // console.log("timestampLast:", timestampLast);

                    let value24HoursLast = null;
                    let timestamp24HoursLast = null;

                    if (lastNonNullValue !== null) {
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
                        delta_24 = "";  // or set to "-1" or something else if you prefer
                    }

                    // console.log("delta_24:", delta_24);

                    // Make sure delta_24 is a valid number before calling parseFloat
                    if (delta_24 !== "" && delta_24 !== null && delta_24 !== undefined) {
                        delta_24 = parseFloat(delta_24).toFixed(2);
                    } else {
                        delta_24 = "-";
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

function fetchAndUpdateStageMidnightTd(stageTd, DeltaTd, tsidStage, flood_level, currentDateTimeMinus2Hours, currentDateTime, currentDateTimeMinus30Hours, setBaseUrl) {
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
                    // console.log("stage:", stage);

                    let dstOffsetHours = getDSTOffsetInHours();
                    // console.log("dstOffsetHours:", dstOffsetHours);

                    const c_count = calculateCCount(tsidStage);

                    const lastNonNullValue = getLastNonNullMidnightValue(stage, stage.name, dstOffsetHours, c_count);
                    // console.log("lastNonNullValue:", lastNonNullValue);

                    let valueLast = null;
                    let timestampLast = null;

                    if (lastNonNullValue !== null) {
                        timestampLast = lastNonNullValue.current6am.timestamp;
                        valueLast = parseFloat(lastNonNullValue.current6am.value).toFixed(2);
                    }
                    // console.log("valueLast:", valueLast);
                    // console.log("timestampLast:", timestampLast);

                    let value24HoursLast = null;
                    let timestamp24HoursLast = null;

                    if (lastNonNullValue !== null) {
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
                        delta_24 = "";  // or set to "-1" or something else if you prefer
                    }

                    // console.log("delta_24:", delta_24);

                    // Make sure delta_24 is a valid number before calling parseFloat
                    if (delta_24 !== "" && delta_24 !== null && delta_24 !== undefined) {
                        delta_24 = parseFloat(delta_24).toFixed(2);
                    } else {
                        delta_24 = "-";
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
                headers: { 'Accept': 'application/json;version=2' }
            })
                .then(response => {
                    if (!response.ok) throw new Error('Network response was not ok');
                    return response.json();
                })
                .then(nws3Days => {
                    // console.log("Raw nws3Days data:", nws3Days);

                    nws3Days.values.forEach(entry => {
                        entry[0] = formatNWSDate(entry[0]);
                    });

                    // console.log("Formatted nws3Days.values:", nws3Days.values);

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

function fetchAndUpdateCrestTd(stageTd, DeltaTd, tsidStage, flood_level, currentDateTimeMinus2Hours, currentDateTimePlus14Days, currentDateTimeMinus30Hours, setBaseUrl) {
    return new Promise((resolve, reject) => {
        if (tsidStage !== null) {
            const urlStage = `${setBaseUrl}timeseries?name=${tsidStage}&begin=${currentDateTimeMinus30Hours.toISOString()}&end=${currentDateTimePlus14Days.toISOString()}&office=${office}`;

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
                    console.log("Stage received:", stage);

                    stage.values.forEach(entry => {
                        entry[0] = formatNWSDate(entry[0]);
                        // console.log("Formatted entry timestamp:", entry[0]);
                    });

                    const lastNonNullValue = getLastNonNullValue(stage);
                    // console.log("lastNonNullValue:", lastNonNullValue);

                    let valueLast = null;
                    let timestampLast = null;
                    if (lastNonNullValue !== null) {
                        timestampLast = lastNonNullValue.timestamp;
                        valueLast = lastNonNullValue.value;
                    }
                    // console.log("valueLast: ", valueLast);
                    // console.log("timestampLast: ", timestampLast);

                    let innerHTMLStage;
                    if (valueLast === null) {
                        innerHTMLStage = "<span class='missing'></span>";
                    } else {
                        const floodClass = determineStageClass(valueLast, flood_level);
                        innerHTMLStage = `<span class='${floodClass}'>${valueLast.toFixed(2)}</span>`;
                    }
                    // console.log("Generated innerHTMLStage:", innerHTMLStage);

                    if (isMobile && timestampLast !== null) {
                        const noBreakTimestamp = timestampLast.slice(0, 5).replace('-', '/');
                        DeltaTd.innerHTML = noBreakTimestamp;
                        // console.log("Mobile timestamp displayed:", noBreakTimestamp);
                    } else {
                        DeltaTd.innerHTML = timestampLast !== null ? timestampLast : '';
                        // console.log("Regular timestamp displayed:", timestampLast);
                    }

                    stageTd.innerHTML = innerHTMLStage;
                    DeltaTd.innerHTML = isMobile && timestampLast !== null
                        ? timestampLast.slice(0, 5).replace('-', '/')
                        : timestampLast;

                    resolve({
                        stageTd: valueLast,
                        deltaTd: isMobile && timestampLast !== null
                            ? timestampLast.slice(0, 5).replace('-', '/')
                            : timestampLast
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
                        // + "<span class='last_max_value' title='" + precip.name + ", Value = " + valuePrecipLast + ", Date Time = " + timestampPrecipLast + "'>"
                        + "<span class='last_max_value'>"
                        // + "<a href='../chart?office=" + office + "&cwms_ts_id=" + precip.name + "&lookback=4' target='_blank'>"
                        + valuePrecipLast
                        // + "</a>"
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
                        // + "<span class='last_max_value' title='" + precip.name + ", Value = " + valuePrecipLast + ", Date Time = " + timestampPrecipLast + "'>"
                        + "<span class='last_max_value'>"
                        // + "<a href='../chart?office=" + office + "&cwms_ts_id=" + precip.name + "&lookback=4' target='_blank'>"
                        + valuePrecipLast
                        // + "</a>"
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

                    let dstOffsetHours = getDSTOffsetInHours();
                    // console.log("dstOffsetHours:", dstOffsetHours);

                    const c_count = calculateCCount(tsidStorage);

                    const lastNonNullValue = getLastNonNullMidnightValue(stage, stage.name, dstOffsetHours, c_count);
                    // console.log("lastNonNullValue:", lastNonNullValue);

                    let valueLast = null;
                    let timestampLast = null;

                    if (lastNonNullValue !== null) {
                        timestampLast = lastNonNullValue.current6am.timestamp;
                        valueLast = parseFloat(lastNonNullValue.current6am.value).toFixed(2);
                    }
                    // console.log("valueLast:", valueLast);
                    // console.log("timestampLast:", timestampLast);

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

/****************************************************************************** NWS CREST OUTPUT FUNCTIONS ******/
function filterDataByTsidCrest(NwsCrestOutput, cwms_ts_id) {
    const filteredData = NwsCrestOutput.filter(item => {
        return item !== null && item.cwms_ts_id === cwms_ts_id;
    });

    return filteredData;
}

async function fetchDataFromNwsCrestForecastsOutput() {
    let urlNwsForecast = null;
    if (cda === "public") {
        urlNwsForecast = '../../../php_data_api/public/json/exportNwsCrestForecasts2Json.json';
    } else if (cda === "internal") {
        urlNwsForecast = '../../../php_data_api/public/json/exportNwsCrestForecasts2Json.json';
    } else {

    }
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

function updateNwsCrestForecastTimeHTML(filteredData, crestCell, crestDateCell) {
    // Find the first non-null item in the filteredData
    const locationData = filteredData.find(item => item !== null);
    if (!locationData) {
        crestCell.innerHTML = ''; // Handle case where no valid data is found
        crestDateCell.innerHTML = ''; // Handle case where no valid data is found
        return;
    }

    // Extract value and date_time from the first valid data object
    const { value, date_time } = locationData;

    if (value && date_time) {
        const monthMap = {
            JAN: '01',
            FEB: '02',
            MAR: '03',
            APR: '04',
            MAY: '05',
            JUN: '06',
            JUL: '07',
            AUG: '08',
            SEP: '09',
            OCT: '10',
            NOV: '11',
            DEC: '12'
        };

        const [day, monthAbbr] = date_time.split('-');
        const month = monthMap[monthAbbr.toUpperCase()];
        const shortDate = `${month}-${day}`;

        // Display value in crestCell with one decimal place (in red color), and shortDate in crestDateCell
        crestCell.innerHTML = `<div style="font-size: 1em; color: red;">${parseFloat(value).toFixed(1)}</div>`; // Value in red and 1 decimal place
        crestDateCell.innerHTML = `<div style="font-size: 1em;">${shortDate}</div>`; // Display date (e.g., "08-APR") with font size 1.5em
    } else {
        crestCell.innerHTML = ''; // If no value exists, clear the cell
        crestDateCell.innerHTML = ''; // If no date_time exists, clear the cell
    }
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