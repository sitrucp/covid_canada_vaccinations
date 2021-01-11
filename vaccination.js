
//GET DATA=================================
// get csv files from working group github repository
var file_dist_prov = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_prov/vaccine_distribution_timeseries_prov.csv";

var file_admin_prov = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_prov/vaccine_administration_timeseries_prov.csv";

var file_dist_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_distribution_timeseries_canada.csv";

var file_admin_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_administration_timeseries_canada.csv";

var file_population = "https://raw.githubusercontent.com/sitrucp/covid_canada_vaccinations/master/statscan_population.csv";

var file_update_time = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/update_time.txt";

Promise.all([
    d3.csv(file_dist_prov),
    d3.csv(file_admin_prov),
    d3.csv(file_dist_canada),
    d3.csv(file_admin_canada),
    d3.csv(file_population),
    d3.csv(file_update_time)
]).then(function(data) {
    //everthing else below is in d3 promise scope

    // get data sets from promise
    var dist_prov = data[0];
    var admin_prov = data[1];
    var dist_canada = data[2];
    var admin_canada = data[3];
    var population = data[4];
    var updateTime = data[5];

    // get update time from working group repository
    lastUpdated = updateTime.columns[0];
    
    document.getElementById('title').innerHTML += ' <small class="text-muted">Last updated: ' + lastUpdated + '</small>';

    // ggt case and mortality totals by summing values
    var distTotalCanada = dist_canada.reduce((a, b) => +a + +b.dvaccine, 0);
    var adminTotalCanada = admin_canada.reduce((a, b) => +a + +b.avaccine, 0);

    // summarize population
    var caseByRegion = d3.nest()
    .key(function(d) { return d.prov_health_region_case; })
    .rollup(function(v) { return {
        case_count: d3.sum(v, function(d) { return d.cases; }),
        case_new_count: d3.sum(v, function(d) { return d.case_new_count; }) 
        };
    })
    .entries(cases)
    .map(function(group) {
        return {
        case_prov_health_region: group.key,
        case_count: group.value.case_count,
        case_new_count: group.value.case_new_count
        }
    });

    // reformat dates, calculate % dist/admin of population
    dist_prov.forEach(function(d) {
        d.report_date = reformatDate(d.date_vaccine_distributed)
        d.prov_date = d.province + '|' + d.date_vaccine_distributed
    });
    admin_prov.forEach(function(d) {
        d.report_date = reformatDate(d.date_vaccine_administered)
        d.prov_date = d.province + '|' + d.date_vaccine_administered
    });
    dist_canada.forEach(function(d) {
        d.report_date = reformatDate(d.date_vaccine_distributed)
        d.prov_date = d.province + '|' + d.date_vaccine_distributed
        d.population = "31,966,591"
    });
    admin_canada.forEach(function(d) {
        d.report_date = reformatDate(d.date_vaccine_administered)
        d.prov_date = d.province + '|' + d.date_vaccine_administered
        d.population = "31,966,591"
    });

    ///Functions start ======================
    // left join function used to join datasets
    function equijoinWithDefault(xs, ys, primary, foreign, sel, def) {
        const iy = ys.reduce((iy, row) => iy.set(row[foreign], row), new Map);
        return xs.map(row => typeof iy.get(row[primary]) !== 'undefined' ? sel(row, iy.get(row[primary])): sel(row, def));
    };

    // reformat dates
    // orig format dd-mm-yyyy, but better as yyyy-mm-dd
    function reformatDate(oldDate) {
        var d = oldDate.split("-")
        var newDate = d[2] + '-' + d[1] + '-' + d[0]
        return newDate
    }

    // moving average function
    function movingAverage(values, N) {
        let i = 0;
        let sum = 0;
        const means = new Float64Array(values.length).fill(NaN);
        for (let n = Math.min(N - 1, values.length); i < n; ++i) {
            sum += values[i];
        }
        for (let n = values.length; i < n; ++i) {
            sum += values[i];
            means[i] = parseInt(sum / N);
            sum -= values[i - N + 1];
        }
        return means;
    }

    ///Functions end ======================

    // left join admin to dist - Canada
    const distAdminCanada = equijoinWithDefault(
        dist_canada, admin_canada, 
        "prov_date", "prov_date", 
        ({province, report_date, dvaccine, cumulative_dvaccine, population}, {avaccine, cumulative_avaccine}, ) => 
        ({province, report_date, dvaccine, cumulative_dvaccine, avaccine, cumulative_avaccine, population}), 
        {prov_date:null, avaccine:"0", cumulative_avaccine:"0"});

    // left join admin to dist - Provinces
    const distAdminProv = equijoinWithDefault(
        dist_prov, admin_prov, 
        "prov_date", "prov_date", 
        ({province, report_date, dvaccine, cumulative_dvaccine}, {avaccine, cumulative_avaccine}, ) => 
        ({province, report_date, dvaccine, cumulative_dvaccine, avaccine, cumulative_avaccine}), 
        {prov_date:null, avaccine:"0", cumulative_avaccine:"0"});

    console.log(distAdminCanada);

    // left join population to distAdminProv
    const distAdminProv = equijoinWithDefault(
        dist_prov, admin_prov, 
        "prov_date", "prov_date", 
        ({province, report_date, dvaccine, cumulative_dvaccine}, {avaccine, cumulative_avaccine}, ) => 
        ({province, report_date, dvaccine, cumulative_dvaccine, avaccine, cumulative_avaccine}), 
        {prov_date:null, avaccine:"0", cumulative_avaccine:"0"});

    // left join population to distAdminProv


 

    // get canada dist & admin max dates
    maxDistDate = d3.max(dist_canada.map(d=>d.report_date));
    maxAdminDate = d3.max(admin_canada.map(d=>d.report_date));

    // create charts
    function createCharts(statscanRegion) {
        // create region details and charts
        var regionCaseCount = getCaseCount(statscanRegion);
        var regionMortCount = getMortCount(statscanRegion);
        var regionProvince = getProvince(statscanRegion);
        var casePctCanada = parseFloat(regionCaseCount / caseTotalCanada * 100).toFixed(2)+"%";
        var mortPctCanada = parseFloat(regionMortCount / mortTotalCanada * 100).toFixed(2)+"%";
        
        // filter to case and mort data to selected region
        var caseSelectedRegion = caseWithStatscan.filter(function(d) { 
            if (statscanRegion === 'Canada') {
                return d.statscan_arcgis_health_region !== statscanRegion;
            } else {
                return d.statscan_arcgis_health_region === statscanRegion;
            }
        });
        var mortSelectedRegion = mortWithStatscan.filter(function(d) { 
            if (statscanRegion === 'Canada') {
                return d.statscan_arcgis_health_region !== statscanRegion;
            } else {
                return d.statscan_arcgis_health_region === statscanRegion;
            } 
        });

        // get min and max case and mort dates for selected region 
        caseDates = caseSelectedRegion.map(function(d) {
            return {"report_date": d.report_date};
        });
        minCaseDate = d3.min(caseDates.map(d=>d.report_date));
        maxCaseDate = d3.max(caseDates.map(d=>d.report_date));
        mortDates = mortSelectedRegion.map(function(d) {
            return {"report_date": d.report_date};
        });
        minMortDate = d3.min(mortDates.map(d=>d.report_date));
        maxMortDate = d3.max(mortDates.map(d=>d.report_date));


        //create daily cases chart
        // get max case count for region for y axis
        if(d3.max(caseRegionByDate.map(d=>d.case_count)) > 5) {
            var regionMaxDailyCaseCount = d3.max(caseRegionByDate.map(d=>d.case_count));
        } else {
            var regionMaxDailyCaseCount = 5;
        }
        
        if (regionCaseCount > 5) {
            var yAxis2RangeMaxCase = regionCaseCount;
        } else {
            var yAxis2RangeMaxCase = 5;
        }
        
        if(regionCaseCount > 0) {
            // create x and y axis data sets
            var xCases = [];
            var yCases = [];
            var xCasesCum = [];
            var yCasesCum = [];
            // create axes x and y arrays
            for (var i=0; i<caseRegionByDate.length; i++) {
                row = caseRegionByDate[i];
                xCases.push( row['report_date']);
                yCases.push( row['case_count']);
                xCasesCum.push( row['report_date']);
                yCasesCum.push( row['cum_case_count']);
            }
            // set up plotly chart
            var casesDaily = {
                name: 'Daily',
                //text: 'Daily',
                x: xCases,
                y: yCases,
                type: 'bar',
                width: 1000*3600*24,
                marker: {
                    color: 'rgb(169,169,169)',
                    line: {
                    color: 'rgb(169,169,169)',
                    width: 1
                    }
                }
            };
            var casesCum = {
                name: 'Cumulative',
                //text: 'Cumulative',
                x: xCasesCum,
                y: yCasesCum,
                yaxis: 'y2',
                type: 'scatter',
                mode: 'lines',
                line: {
                    shape: 'linear', 
                    color: 'rgb(64,64,64)',
                    width: 2
                },
                connectgaps: true
            };
            var casesMA = {
                name: '7D MA',
                //text: '7D MA',
                x: xCases,
                y: movingAverage(yCases, 7),
                yaxis: 'y',
                type: 'scatter',
                mode: 'lines',
                line: {
                    shape: 'linear', 
                    color: 'rgb(5,113,176)',
                    width: 2
                },
                connectgaps: true
            };
            var caseChartData = [casesDaily, casesCum, casesMA];
            var caseChartLayout = {
                title: {
                    text:'Cases',
                    font: {
                        weight: "bold",
                        size: 12
                    },
                },
                showlegend: true,
                legend: {
                    "orientation": "h",
                    x: 0,
                    xanchor: 'left',
                    y: 1,
                    bgcolor: 'rgba(0,0,0,0)',
                    font: {
                        //family: 'sans-serif',
                        size: 10
                        //color: '#000'
                    },
                },
                autosize: false,
                autoscale: false,
                width: 250,
                height: 150,
                margin: {
                    l: 30,
                    r: 40,
                    b: 30,
                    t: 25,
                    pad: 2
                },
                xaxis: { 
                    //autotick: true,
                    //mirror: 'allticks',
                    type: "date",
                    tickformat: "%b-%d",
                    tickfont: {
                        size: 10
                    },
                    tickangle: 0,
                    //autorange: false,
                    range:[
                        new Date(minCaseDate).getTime(),
                        new Date(maxCaseDate).getTime()
                    ],
                    //tickmode: 'auto',
                    //nticks: 5,
                    //tick0: '2020-03-05',
                    //dtick: 1209600000.0,
                    //autotick: false,
                    //nticks: 5,
                // autorange: false,
                },
                yaxis: { 
                    //autorange: true, 
                    tickfont: {
                        size: 10
                    },
                    range:[0, regionMaxDailyCaseCount],
                    showgrid: false
                },
                yaxis2 : {
                    //autorange: true, 
                    type: yaxis2_type,
                    tickfont: {
                        size: 10
                    },
                    range:[0, yAxis2RangeMaxCase],
                    overlaying: 'y',
                    side: 'right',
                    showgrid: false
                }
            };
            Plotly.newPlot('region_daily_cases_chart', caseChartData, caseChartLayout);
        } else {
            document.getElementById('region_daily_cases_chart').innerHTML = '';
        }

        // daily mort chart==================
        // get max mort count for region for y axis
        
        if(d3.max(mortRegionByDate.map(d=>d.mort_count)) > 5) {
            var regionMaxDailyMortCount = d3.max(mortRegionByDate.map(d=>d.mort_count));
        } else {
            var regionMaxDailyMortCount = 5;
        }
        
        if (regionMortCount > 5) {
            var yAxis2RangeMaxMort = regionMortCount;
        } else {
            var yAxis2RangeMaxMort = 5;
        }
        
        if(regionMortCount > 0) {
            // create x and y axis data sets
            var xMort = [];
            var yMort = [];
            var xMortCum = [];
            var yMortCum = [];

            for (var i=0; i<mortRegionByDate.length; i++) {
                row = mortRegionByDate[i];
                xMort.push( row['report_date'] );
                yMort.push( row['mort_count'] );
                xMortCum.push( row['report_date']);
                yMortCum.push( row['cum_mort_count']);
            }
            
            // set up plotly chart
            var mortsDaily = {
                name: 'Daily',
                //text: 'Daily',
                x: xMort,
                y: yMort,
                type: 'bar',
                width: 1000*3600*24,
                marker: {
                    color: 'rgb(169,169,169)',
                    line: {
                    color: 'rgb(169,169,169)',
                    width: 1
                    }
                }
            };
            var mortsCum = {
                name: 'Cumulative',
                //text: 'Cumulative',
                x: xMortCum,
                y: yMortCum,
                yaxis: 'y2',
                type: 'scatter',
                mode: 'lines',
                line: {
                    shape: 'linear',
                    color: 'rgb(64,64,64)',
                    width: 2
                },
                
                connectgaps: true
            };
            var mortsMA = {
                name: '7D MA',
                //text: '7D MA',
                x: xMort,
                y: movingAverage(yMort, 7),
                yaxis: 'y',
                type: 'scatter',
                mode: 'lines',
                line: {
                    shape: 'linear',
                    color: 'rgb(5,113,176)',
                    width: 2
                },
                connectgaps: true
            };
            var mortChartData = [mortsDaily, mortsCum, mortsMA];
            var mortChartLayout = {
                title: {
                    text:'Mortalities',
                    font: {
                        weight: "bold",
                        size: 12
                    },
                },
                showlegend: false,
                autosize: false,
                autoscale: false,
                width: 250,
                height: 150,
                margin: {
                    l: 30,
                    r: 35,
                    b: 50,
                    t: 25,
                    pad: 5
                },
                xaxis: { 
                    //autotick: true,
                    //mirror: 'allticks',
                    type: "date",
                    tickformat: "%b-%d",
                    tickfont: {
                        size: 10
                    },
                    tickangle: 0,
                    range:[
                        new Date(minCaseDate).getTime(), 
                        new Date(maxCaseDate).getTime()
                    ],
                    //tickmode: 'auto',
                    //nticks: 5,
                    //tick0: '2020-03-05',
                    //dtick: 1209600000.0,
                    //tickmode: 'linear',
                    //tick0: '2020-03-05'
                    //dtick: 432000000,
                },
                yaxis: { 
                    tickfont: {
                        size: 10
                    },
                    tickformat: ',d',
                    autorange: false, 
                    range:[0, regionMaxDailyMortCount],
                    showgrid:false
                },
                yaxis2 : {
                    tickfont: {
                        size: 10
                    },
                    tickformat: ',d',
                    autorange: false, 
                    range:[0, yAxis2RangeMaxMort],
                    overlaying: 'y',
                    side: 'right',
                    showgrid:false
                }
            };
            Plotly.newPlot('region_daily_morts_chart', mortChartData, mortChartLayout);
        } else {
            document.getElementById('region_daily_morts_chart').innerHTML = '';
        }
    }
        
    //CREATE TABLE BELOW MAP=================================
    $(document).ready(function () {
        var thead;
        var thead_tr;
        thead = $("<thead>");
        thead_tr = $("<tr/>");
        thead_tr.append("<th>Province</th>");
        thead_tr.append("<th style='text-align: right';>Case Count</th>");
        thead_tr.append("<th style='text-align: right';>Doses Distributed</th>");
        thead_tr.append("<th style='text-align: right';Doses Administered</th>");
        thead_tr.append("<th style='text-align: right';>Population</th>");
        thead_tr.append("<th style='text-align: right';>Dist % Pop'n</th>");
        thead_tr.append("<th style='text-align: right';>Admin % Pop'n</th>");
        thead_tr.append("<th style='text-align: right';>Dist Rate</th>");thead_tr.append("<th style='text-align: right';>Admin Rate</th>");
        thead_tr.append("<th style='text-align: right';>Dist Complete Days</th>");
        thead_tr.append("<th style='text-align: right';>Admin Complete Days</th>");
        thead_tr.append("</tr>");
        thead.append(thead_tr);
        $('table').append(thead);
        var tbody;
        var tbody_tr;
        tbody = $("<tbody>");
        $('table').append(tbody);
        for(var i = 0; i < covidData.length; i++) {
            var obj = covidData[i];
            tbody_tr = $('<tr/>');
            tbody_tr.append("<td>" + obj.province + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + obj.case_count + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + obj.mort_count + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + parseFloat(obj.case_count / caseTotalCanada * 100).toFixed(2) + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + parseFloat(obj.mort_count / mortTotalCanada * 100).toFixed(2) + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + getRatioMortCase(obj.mort_count, obj.case_count) + "</td>");
            tbody.append(tbody_tr);
            tbody_tr.append("<td style='text-align: right';>" + obj.case_new_count + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + obj.mort_new_count + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + parseFloat(obj.case_new_count / caseNewCanada * 100).toFixed(2) + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + parseFloat(obj.mort_new_count / mortNewCanada * 100).toFixed(2) + "</td>");
            tbody_tr.append("<td style='text-align: right';>" + parseFloat(obj.mort_new_count / mortNewCanada * 100).toFixed(2) + "</td>");
        }
    });

    // add tablesorter js to allow user to sort table by column headers
    $(document).ready(function($){ 
        $("#covid_tabular").tablesorter();
    }); 

});
