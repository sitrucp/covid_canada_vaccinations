
//GET DATA=================================
// get csv files from working group github repository
var file_dist_prov = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_prov/vaccine_distribution_timeseries_prov.csv";

var file_admin_prov = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_prov/vaccine_administration_timeseries_prov.csv";

var file_dist_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_distribution_timeseries_canada.csv";

var file_admin_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_administration_timeseries_canada.csv";

var file_forecast = "https://raw.githubusercontent.com/sitrucp/covid_canada_vaccinations/master/forecast.csv";

//var file_forecast = "/ws_covid_vaccination_canada/forecast.csv";

var file_population = "https://raw.githubusercontent.com/sitrucp/covid_canada_vaccinations/master/population.csv";

var file_update_time = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/update_time.txt";

// D3 promise to get all data at once
Promise.all([
    d3.csv(file_dist_prov),
    d3.csv(file_admin_prov),
    d3.csv(file_dist_canada),
    d3.csv(file_admin_canada),
    d3.csv(file_forecast),
    d3.csv(file_population),
    d3.csv(file_update_time)
]).then(function(data) {
    //everthing else below is in d3 promise scope

    // get data from promise
    var arrDistProv = data[0];
    var arrAdminProv = data[1];
    var arrDistCanada = data[2];
    var arrAdminCanada = data[3];
    var arrForecast = data[4];
    var arrPopulation = data[5];
    var updateTime = data[6];

    // get last updated datetime
    lastUpdated = updateTime.columns[0];
    
    // write last update datetime
    document.getElementById('last_update').innerHTML += ' <small class="text-muted">Data updated: ' + lastUpdated + '</small>';

    // ggt dist and admin totals by summing array values
    var distCanadaTotal = arrDistCanada.reduce((a, b) => +a + +b.dvaccine, 0);
    var adminCanadaTotal = arrAdminCanada.reduce((a, b) => +a + +b.avaccine, 0);
    var forecastCanadaTotal = arrForecast.reduce((a, b) => +a + +b.avaccine, 0); // use this if arrForecast data is at prov level but currently it is only Canada level

    // define percent population variable - could do dynamic user variable eg to see 70% pop instead of 100% (herd immunity)
    var popPercent = 1;

    // create color variables - not used
    var colActual = '#ffffb2';
    var colFuture = 'rgba(204,204,204, .9)';
    var colActual = '#fd8d3c';
    var colActual = '#f03b20';
    var colActual = '#bd0026';

    // filter province arrPopulation dataset by age_group
    var sel_age_group = '18 years and over';
    var arrPopulationFiltered = arrPopulation.filter(function(d) { 
        return d.age_group == sel_age_group;
    });
    
    // summarize population dataset by Canada
    var popCanada = arrPopulationFiltered.reduce((a, b) => +a + +b.population, 0);

    // summarize population dataset by province
    var arrPopulationProv = d3.nest()
        .key(function(d) { return d.geo; })
        .rollup(function(v) { return {
            population: d3.sum(v, function(d) { return d.population; })
            };
        })
        .entries(arrPopulationFiltered)
        .map(function(group) {
            return {
            province: group.key,
            population: group.value.population
            }
        });

    // update arrays - reformat dates, calculate % dist/admin of population etc
    arrDistProv.forEach(function(d) {
        d.report_date = reformatDate(d.date_vaccine_distributed)
        d.prov_date = d.province + '|' + d.date_vaccine_distributed
    });

    arrAdminProv.forEach(function(d) {
        d.report_date = reformatDate(d.date_vaccine_administered)
        d.prov_date = d.province + '|' + d.date_vaccine_administered
    });

    arrForecast.forEach(function(d) {
        d.report_date = reformatDate(d.report_date)
        d.prov_date = d.province + '|' + d.report_date
    });

    arrDistCanada.forEach(function(d) {
        d.report_date = reformatDate(d.date_vaccine_distributed)
        d.prov_date = d.province + '|' + d.date_vaccine_distributed
        d.population = popCanada
    });

    arrAdminCanada.forEach(function(d) {
        d.report_date = reformatDate(d.date_vaccine_administered)
        d.prov_date = d.province + '|' + d.date_vaccine_administered
    });

    // get canada dist & admin max dates
    var maxDistDate = d3.max(arrDistCanada.map(d=>d.report_date));
    var maxAdminDate = d3.max(arrAdminCanada.map(d=>d.report_date));
    
    // left join admin to dist - Canada
    const arrDistAdminCanadaPop = equijoinWithDefault(
        arrDistCanada, arrAdminCanada, 
        "prov_date", "prov_date", 
        ({province, report_date, dvaccine, cumulative_dvaccine, population}, {avaccine, cumulative_avaccine}, ) => 
        ({province, report_date, dvaccine, cumulative_dvaccine, avaccine, cumulative_avaccine, population}), 
        {prov_date:null, avaccine:"0", cumulative_avaccine:"0"});

    // add percentages to distAdminCanada
    arrDistAdminCanadaPop.forEach(function(d) {
        d.pct_pop_dist = parseInt(d.cumulative_dvaccine) / parseInt(d.population)
        d.pct_pop_admin = parseInt(d.cumulative_avaccine) / parseInt(d.population)
        d.pct_dist_admin = parseInt(d.cumulative_avaccine) / parseInt(d.cumulative_dvaccine)
        d.count_type = 'actual'
    });

    // left join admin to dist - Provinces
    const arrDistAdminProv = equijoinWithDefault(
        arrDistProv, arrAdminProv, 
        "prov_date", "prov_date", 
        ({province, report_date, dvaccine, cumulative_dvaccine}, {avaccine, cumulative_avaccine}, ) => 
        ({province, report_date, dvaccine, cumulative_dvaccine, avaccine, cumulative_avaccine}), 
        {avaccine:"0", cumulative_avaccine:"0"});

    // map population to arrDistAdminProv
    const arrDistAdminProvPop = arrDistAdminProv.map(t1 => ({...t1, ...arrPopulationProv.find(t2 => t2.province === t1.province)}))

    // add percentages to arrDistAdminProvPop
    arrDistAdminProvPop.forEach(function(d) {
        d.pct_pop_dist = parseInt(d.cumulative_dvaccine) / parseInt(d.population)
        d.pct_pop_admin = parseInt(d.cumulative_avaccine) / parseInt(d.population)
        d.pct_dist_admin = parseInt(d.cumulative_avaccine) / parseInt(d.cumulative_dvaccine)
        d.count_type = 'actual'
    });

    
    function createCanadaForecastChart() {

        // define location
        var province = "Canada";
        
        // define x and y arrays
        var xActual = [];
        var yActual = [];
        var xPfizer = [];
        var yPfizer = [];
        var xModerna = [];
        var yModerna = [];
        var xOther = [];
        var yOther = [];
        var xCumForecast = [];
        var yCumForecast = [];
        var xCumActual = [];
        var yCumActual = [];

        // create x y arrays - actual administered
        for (var i=0; i<arrDistAdminCanadaPop.length; i++) {
            var row = arrDistAdminCanadaPop[i];
            xActual.push(row['report_date']);
            yActual.push(parseInt(row['dvaccine']));
            xCumActual.push(row['report_date']);
            yCumActual.push(parseInt(row['cumulative_dvaccine']));
        }

        // create x y arrays - forecast 
        for (var i=0; i<arrForecast.length; i++) {
            var row = arrForecast[i];
            xPfizer.push(row['report_date']);
            yPfizer.push(parseInt(row['daily_pfizer'].replace(/,/g, '')));
            xModerna.push(row['report_date']);
            yModerna.push(parseInt(row['daily_moderna'].replace(/,/g, '')));
            xOther.push(row['report_date']);
            yOther.push(parseInt(row['daily_other'].replace(/,/g, '')));
            xCumForecast.push(row['report_date']);
            yCumForecast.push(parseInt(row['total_cumulative'].replace(/,/g, '')));
        }

        // get current yCumForecast value, by get xCumForecast current date index, then find yCumForecast value at that index
        var currDateIndex = xCumForecast.findIndex(x => x.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]);
        var maxCumForecast = yCumForecast[currDateIndex];

        // get max yCumActual value
        var maxCumActual = Math.max(...yCumActual);

        // plotly chart trace
        var trActual = {
            name: 'Delivered',
            hoverlabel: {
                namelength :-1
            },
            x: xActual,
            y: replaceZeros(yActual),
            showgrid: false,
            mode: 'markers',
            type: 'scatter',
            //type: 'bar',
            marker: {
                color: 'rgba(0, 0, 0, .6)', // '#000000',
                size: 5
            },
        };
        
         // plotly chart trace
        var trPfizer = {
            name: 'Pfizer Forecast',
            hoverlabel: {
                namelength :-1
            },
            x: xPfizer,
            y: yPfizer,
            showgrid: false,
            type: 'bar',
            marker:{
                color: 'rgba(189, 0, 38, .6)' // '#bd0026'
            },
        };

         // plotly chart trace
        var trModerna = {
            name: 'Moderna Forecast',
            hoverlabel: {
                namelength :-1
            },
            x: xModerna,
            y: yModerna,
            showgrid: false,
            type: 'bar',
            marker:{
                color: 'rgba(240,59,32, .6)' // '#f03b20'
            },
        };

         // plotly chart trace
        var trOther = {
            name: 'Other Forecast',
            hoverlabel: {
                namelength :-1
            },
            x: xOther,
            y: yOther,
            showgrid: false,
            type: 'bar',
            marker:{
                color: 'rgba(253, 141, 60, .6)' // '#fd8d3c'
            },
        };

         // plotly chart trace
        var trCumForecast = {
            name: 'Forecast Cumulative',
            hoverlabel: {
                namelength :-1
            },
            yaxis: 'y2',
            x: xCumForecast,
            y: yCumForecast,
            showgrid: false,
            mode: 'line',
            line: {
                dash: 'dot',
                width: 2
            },
            marker:{
                color: 'rgba(0, 0, 0, .8)' // '#000000',
            },
        };

         // plotly chart trace
        var trCumActual = {
            name: 'Delivered Cumulative',
            hoverlabel: {
                namelength :-1
            },
            yaxis: 'y2',
            x: xCumActual,
            y: yCumActual,
            showgrid: false,
            line: {
                //dash: 'dot',
                width: 2
            },
            marker:{
                color: 'rgba(0, 0, 0, .8)' // '#000000',
            },
        };

         // plotly chart layout
        var layout = {
            title: {
                text:'Canada COVID-19 Vaccine Delivery <br> Actual vs Forecast By Sep 30',
                font: {
                    size: 14
                },
            },
            barmode: 'relative',
            showlegend: true,
            legend: {
                "y": 1.09, 
                "x": 0.15,
                legend_title_text: "",
                orientation: "h",
                bgcolor: 'rgba(0,0,0,0)',
            },
            //width: 800,
            height: 600,
            yaxis: { 
                title: {
                    text: 'daily dose count',
                    font: {
                        size: 11,
                    },
                },
                tickfont: {
                    size: 11
                },
                showgrid:false,
                rangemode: 'tozero',
            },
            yaxis2: {
                title: {
                    text: 'cumulative dose count',
                    font: {
                        size: 11,
                    },
                },
                tickfont: {
                    size: 11
                },
                overlaying: 'y',
                side: 'right',
                showgrid: false,
                rangemode: 'tozero',
            },
            xaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false,
            },
            autosize: true,
            autoscale: false,
            margin: {
                l: 80,
                r: 80,
                b: 80,
                t: 120
            },
        }

        // create chart section text content
        var canadaForecastDiv = 'canadaForecastDiv';
        var canadaForecastTitle = 'title' + canadaForecastDiv;
        var titleCanadaForecastChart = document.createElement("p");
        var div_canada_forecast_chartItem = document.createElement("div");
        div_canada_forecast_chartItem.id = canadaForecastDiv;
        titleCanadaForecastChart.id = canadaForecastTitle;
        var chartDetails = '<h4>' + province + ' - Actual vs Forecast Dose Delivery</h4>' + 
            '<p>Following the Feb 2021 vaccine delivery disruptions the Government of Canada (GoC) has received delivery schedule commitments for 84m vaccine doses (40m Pfizer & 44m Moderna) by Sep 30:</p>' +
            '<ul class="list-unstyled">' + 
            '<li>To Mar 31, 6 million total:</li>' +
            '<li>* Pfizer 4 million</li>' +
            '<li>* Moderna 2 million</li>' +
            '</ul>' +
            '<ul class="list-unstyled">' + 
            '<li>Apr 1-Jun 30, 23 million total:</li>' +
            '<li>* Pfizer 10.8 million</li>' +
            '<li>* Moderna 12.2 million</li>' +
            '</ul>' +
            '<ul class="list-unstyled">' + 
            '<li>Jul 1-Sep 30, 55 million total:</li>' +
            '<li>* Pfizer 25.2 million</li>' +
            '<li>* Moderna 29.8 million</li>' +
            '</ul>' +
            '<ul class="list-unstyled">' + 
            '<li>By Sep 30, 84 million delivered.</li>' +
            '</ul>' + 
            '<p>This delivery schedule has been modelled in the visualization below which compares actual doses delivered (black dots) vs  forecast daily dose deliveries (orange and red bars), and cumulative actual deliveries (solid black line) vs cumulative forecast deliveries (dotted black line). Hopefully cumulative actual deliveries follows cumulative forecast deliveries!</p>' +
            '<ul class="list-unstyled">' + 
            '<li>Current Cumulative Delivery Counts:</li>' +
            '<li>* Forecast: ' + maxCumForecast.toLocaleString() + '</li>' +
            '<li>* Actual: ' + maxCumActual.toLocaleString() + '</li>' +
            '</ul>';
        titleCanadaForecastChart.innerHTML = chartDetails;
        document.getElementById('div_canada_forecast_chart').append(titleCanadaForecastChart);
        document.getElementById('div_canada_forecast_chart').append(div_canada_forecast_chartItem);

        // plotly data, config, create chart
        var data = [trPfizer, trModerna, trCumForecast, trActual, trCumActual];
        var config = {responsive: true}
        Plotly.newPlot('canadaForecastDiv', data, layout, config);

    }


    function createCanadaChart() {
        // ggt dist and admin totals by summing values, and population using max
        var province = "Canada";
        var max_pct_dist_admin = d3.max(arrDistAdminCanadaPop.map(d=>d.pct_dist_admin));
        var population = d3.max(arrDistAdminCanadaPop.map(d=>d.population));
        var dosePopulation = parseInt((population * 2) * popPercent);
        var max_pct_dist_admin = d3.max(arrDistAdminCanadaPop.map(d=>d.pct_dist_admin));

        // get future data
        var arrRemaining = createRemaining(dosePopulation, maxAdminDate, distCanadaTotal, adminCanadaTotal, province);

        // left join arrRemaining to arrForecast
        const arrRemainForecast = equijoinWithDefault(
            arrRemaining, arrForecast, 
            "prov_date", "prov_date", 
            ({province, report_date, prov_date, count_type, avaccine, dvaccine}, {daily_moderna, daily_pfizer, daily_other, daily_total, total_cumulative}, ) => 
            ({province, report_date, prov_date, count_type, avaccine, dvaccine, daily_moderna, daily_pfizer, daily_other, daily_total, total_cumulative}), 
            {daily_moderna:"0", daily_pfizer:"0", daily_other:"0", daily_total:"0", total_cumulative:"0"});
            
        // create new 'required' value for future minus remaining, if any remaining
        arrRemainForecast.forEach(function(d) {
            d.required = parseInt(d.avaccine);
            if ( parseInt(d.daily_total.replace(/,/g, '')) < parseInt(d.avaccine)) {
                d.required = parseInt(d.avaccine) - parseInt(d.daily_total.replace(/,/g, ''));
            } else {
                d.required = 0;
            }
        });

        // CREATE CANADA CHART

        // create x and y axis data sets
        var xActual = [];
        var yActual = [];
        var xRemain = [];
        var yRemain = [];

        // create axes x and y arrays
        for (var i=0; i<arrDistAdminCanadaPop.length; i++) {
            var row = arrDistAdminCanadaPop[i];
            xActual.push(row['report_date']);
            yActual.push(parseInt(row['avaccine']));
        }

        for (var i=0; i<arrRemainForecast.length; i++) {
            var row = arrRemainForecast[i];
            xRemain.push(row['report_date']);
            yRemain.push(parseInt(row['avaccine']));
        }

        var actual = {
            name: 'Actual',
            x: xActual,
            y: yActual,
            showgrid: false,
            type: 'bar',
            marker:{
                color: fillColor(xActual, maxAdminDate)
            },
        };

        var future = {
            name: 'Remaining',
            x: xRemain,
            y: yRemain,
            showgrid: false,
            //type: 'line',
            type: 'bar',
            marker:{
                color: 'rgba(204,204,204, .9)'
                //color: fillColor(xRemain, maxAdminDate)
            },
        };

        var layout = {
            title: {
                text:'Canada Actual vs Remaining Dose Administration <br> Required To Meet Sep 30 Goal',
                font: {
                    size: 14
                },
            },
            barmode: 'relative',
            showlegend: true,
            legend: {
                "y": 1.07, 
                "x": 0.3,
                legend_title_text: "",
                orientation: "h",
                bgcolor: 'rgba(0,0,0,0)',
            },
            yaxis: { 
                title: {
                    text: 'daily dose count',
                    font: {
                        size: 11,
                    },
                },
                tickfont: {
                    size: 11
                },
                showgrid:false
            },
            xaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false,
            },
            autosize: true,
            autoscale: false,
            margin: {
                l: 80,
                r: 80,
                b: 80,
                t: 80
            },
        }

        // create chart section text content
        var canadaDiv = 'canadaDiv';
        var canadaTitle = 'title' + canadaDiv;
        var titleCanadaChart = document.createElement("p");
        var div_canada_chartItem = document.createElement("div");
        div_canada_chartItem.id = canadaDiv;
        titleCanadaChart.id = canadaTitle;
        var chartDetails = '<ul class="list-unstyled"><li><h4>' + province + ' - Actual vs Remaining Dose Administration</h4>' +
            '</li><li>Target Popluation ('+ parseInt(popPercent * 100) + '% Age 18+): ' + population.toLocaleString() + '</li>' + 
            '<li>Doses Distributed: ' + distCanadaTotal.toLocaleString() + '</li>' +
            '<li>Doses Administered: ' + adminCanadaTotal.toLocaleString() + '</li>' +
            '<li>Distributed Doses Administered: ' + ((adminCanadaTotal/distCanadaTotal) * 100).toFixed(1) + '%</li>' +
            '<li>Doses Required To Fully Vaccinate Target Pop: ' + (dosePopulation).toLocaleString() + '</li>' +
            '<li>Doses Remaining To Fully Vaccinate Target Pop: ' + (dosePopulation - adminCanadaTotal).toLocaleString() + ' </li>' +
            '<li>Target Population Doses Administered: ' + ((adminCanadaTotal / dosePopulation) * 100).toFixed(2) + '%</li>' +
            '<li>' + parseInt(((dosePopulation - adminCanadaTotal) / daysToGoalDate())).toLocaleString() + ' doses must be adminstered daily, starting today, to meet Sep 30 goal.</li>' +
            '<li class="small font-italic"">Click "Read More" link above for details on calculations.</li>' +
            '</ul>'  +
            '<p>The visualization below compares the actual count of vaccine doses administered to-date across Canada as reported by provinces (blue bars) vs calculated remaining dose administration required to fully vaccinate age 18+ population by Sep 30, 2021 (gray bars).</p>';
        titleCanadaChart.innerHTML  = chartDetails;
        document.getElementById('div_canada_remain_chart').append(titleCanadaChart);
        document.getElementById('div_canada_remain_chart').append(div_canada_chartItem);

        // plotly data, config, create chart
        var data = [actual, future];
        var config = {responsive: true}
        Plotly.newPlot('canadaDiv', data, layout, config);

    }


    function createProvChart() {
        // CREATE PROV CHART

        // get list of provinces 
        provListTemp = [];
        for (var i=0; i<arrDistAdminProvPop.length; i++) {
            province = arrDistAdminProvPop[i]['province'];
            provListTemp.push(province);
        }
        let provList = [...new Set(provListTemp)];

        // create prov charts by loop through provList to create chart for each prov
        for (var j=0; j<provList.length; j++) {

            var provData = arrDistAdminProvPop.filter(function(d) { 
                return d.province === provList[j];
            });

            // ggt dist and admin totals by summing values, and population using max
            var distTotalProv = provData.reduce((a, b) => +a + +b.dvaccine, 0);
            var adminTotalProv = provData.reduce((a, b) => +a + +b.avaccine, 0);
            var population = d3.max(provData.map(d=>d.population));
            var dosePopulation = parseInt((population * 2) * popPercent);
            var max_pct_dist_admin = d3.max(provData.map(d=>d.pct_dist_admin));

            // get future data 
            var arrRemaining = createRemaining(dosePopulation, maxAdminDate, distTotalProv, adminTotalProv, provList[j]);

            // concat actual and future data
            //var dataConcat = provData.concat(arrRemaining);

            // CREATE PROV CHART
            // create x and y axis data sets
            // create x and y axis data sets
            var xActual = [];
            var xRemain = [];
            var yActual = [];
            var yRemain = [];

            // create axes x and y arrays
            for (var i=0; i<provData.length; i++) {
                var row = provData[i];
                xActual.push(row['report_date']);
                yActual.push(parseInt(row['avaccine']));
            }

            for (var i=0; i<arrRemaining.length; i++) {
                var row = arrRemaining[i];
                xRemain.push(row['report_date']);
                yRemain.push(parseInt(row['avaccine']));
            }

            // create Prov chart
            var actual = {
                name: 'Actual',
                x: xActual,
                y: yActual,
                showgrid: false,
                fill: 'tozeroy',
                type: 'bar',
                marker:{
                    color: fillColor(xActual, maxAdminDate)
                },
            };
    
            var future = {
                name: 'Remaining',
                x: xRemain,
                y: yRemain,
                showgrid: false,
                fill: 'tozeroy',
                type: 'bar',
                marker:{
                    color: fillColor(xRemain, maxAdminDate)
                },
            };
            
            var layout = {
                showlegend: true,
                legend: {
                    "y": 1.07,
                    "x": 0.3,
                    legend_title_text: "",
                    orientation: "h",
                    bgcolor: 'rgba(0,0,0,0)',
                },
                yaxis: { 
                    title: {
                        text: 'daily dose count',
                        font: {
                            size: 11,
                        },
                    },
                    tickfont: {
                        size: 11
                    },
                    showgrid:false
                },
                xaxis: { 
                    tickfont: {
                        size: 11
                    },
                    showgrid:false
                },
                autosize: true,
                autoscale: false,
                margin: {
                    l: 80,
                    r: 80,
                    b: 80,
                    t: 80
                },
                title: {
                    text: provList[j] + ' Actual vs Remaining Dose Administration <br> Required To Meet Sep 30 Goal',
                    font: {
                        size: 14
                    },
                },
            }

            // create chart section text content
            var provDiv = 'provDiv' + j;
            var provTitle = 'title' + provDiv;
            var titleProvChart = document.createElement("p");
            var div_prov_chartItem = document.createElement("div");
            div_prov_chartItem.id = provDiv;
            titleProvChart.id = provTitle;
            var chartDetails = '<ul class="list-unstyled"><li><h4>' + provList[j] + ' - Actual vs Remaining Dose Administration</h4>' +
                '</li><li>Target Popluation ('+ parseInt(popPercent * 100) + '% Age 18+): ' + population.toLocaleString() + '</li>' + 
                '<li>Doses Distributed: ' + distTotalProv.toLocaleString() + '</li>' +
                '<li>Doses Administered: ' + adminTotalProv.toLocaleString() + '</li>' +
                '<li>Distributed Doses Administered: ' + ((adminTotalProv/distTotalProv) * 100).toFixed(1) + '%</li>' +
                '<li>Doses Required To Fully Vaccinate Target Pop: ' + (dosePopulation).toLocaleString() + '</li>' +
                '<li>Doses Remaining To Fully Vaccinate Target Pop: ' + (dosePopulation - adminTotalProv).toLocaleString() + ' </li>' +
                '<li>Target Population Doses Administered: ' + ((adminTotalProv / dosePopulation) * 100).toFixed(2) + '%</li>' +
                '<li>' + parseInt(((dosePopulation - adminTotalProv) / daysToGoalDate())).toLocaleString() + ' doses must be adminstered daily, starting today, to meet Sep 30 goal.</li>' +
                '<li class="small font-italic"">Click "Read More" link above for details on calculations.</li>' +
                '</ul>' +
                '<p>The visualization below compares the actual count of vaccine doses administered to-date as reported by ' + provList[j] + ' (blue bars) vs calculated remaining dose administration required to fully vaccinate age 18+ population by Sep 30, 2021 (gray bars).</p>';
            titleProvChart.innerHTML  = chartDetails;
            document.getElementById('div_prov_remain_chart').append(titleProvChart);
            document.getElementById('div_prov_remain_chart').append(div_prov_chartItem);
            
            // plotly data, config, create chart
            var data = [actual, future];
            var config = {responsive: true}
            Plotly.newPlot(provDiv, data, layout, config);

        }
    }

    // create charts when page loads
    createCanadaForecastChart();
    createCanadaChart();
    createProvChart();

    // create remaining data
    function createRemaining(popDose, maxDate, dist, admin, prov) {
        // maxDate is max date in original data eg last date reported
        // and is date that remaining data begins

        // calculate daysRemaining (# days) eg maxDate to Sep 30
        var daysRemaining = daysToGoalDate();

        // create remaining variables
        var arrRemaining = [];
        var province = prov;
        var avaccine_full_req = (popDose - admin)
        var dvaccine_full_req = (popDose - dist)
        var avaccine = avaccine_full_req / daysRemaining;
        var dvaccine = dvaccine_full_req / daysRemaining;

        // loop through days remaining to create new calculated records
        for (var i=1; i<daysRemaining; i++) { 
            var report_date = new Date(maxDate);
            report_date.setDate(report_date.getDate() + i);
            var prov_date = province + '|' + report_date;
            var cumulative_avaccine = admin + (avaccine * i);
            var cumulative_dvaccine = dist + (dvaccine * i);
            var pct_dist_admin = cumulative_avaccine / cumulative_dvaccine;
            var pct_pop_admin = cumulative_avaccine / popDose;
            var pct_pop_dist = cumulative_dvaccine / popDose;
            var count_type = 'required';
            arrRemaining.push({
                province,
                report_date, 
                prov_date,
                avaccine, 
                dvaccine, 
                cumulative_avaccine, 
                cumulative_dvaccine, 
                pct_dist_admin,
                pct_pop_admin,
                pct_pop_dist,
                count_type
            });
        }
        return arrRemaining;
    }

    // create days remaining
    function daysToGoalDate() {
        var endDate = new Date("9/30/2021");
        return Math.floor((endDate - maxAdminDate) / (1000*60*60*24))
    }

    // assign bar color
    function fillColor(x, maxDate) {
        colors = [];
        for (var i=0; i<x.length; i++) {
            if (Date.parse(x[i]) > Date.parse(maxDate)) {
                colors.push('rgba(204,204,204, .9)'); // gray
            } else {
                colors.push('rgba(49,130,189, .9)'); // blue
            }
        }
        return colors
    }

    // assign marker color
    function markerColor(x) {
        colors = [];
        for (var i=0; i<x.length; i++) {
            if (x[i] == 0) {
                colors.push('rgba(0, 0, 0, 0)'); // black
            } else {
                colors.push('rgba(0, 0, 0, .6)'); // black transparent
            }
        }
        return colors
    }

    // assign marker color
    function replaceZeros(x) {
        arrValues = [];
        for (var i=0; i<x.length; i++) {
            if (x[i] == 0) {
                arrValues.push(''); 
            } else {
                arrValues.push(x[i]);
            }
        }
        return arrValues
    }

    // dataset left join function
    function equijoinWithDefault(xs, ys, primary, foreign, sel, def) {
        const iy = ys.reduce((iy, row) => iy.set(row[foreign], row), new Map);
        return xs.map(row => typeof iy.get(row[primary]) !== 'undefined' ? sel(row, iy.get(row[primary])): sel(row, def));
    };

    // reformat date to date object
    function reformatDate(oldDate) {
        // 17-12-2020 is working group date format
        var d = (oldDate).split('-');
        var newDate = new Date(d[1] + '/' + d[0] + '/' + d[2]);
        return newDate
    }

    // reformat date to date object
    function reformatDate2(oldDate) {
        // 17-12-2020 is working group date format
        var d = (oldDate).split('-');
        var newDate = new Date(d[1] + '/' + d[0] + '/' + d[2]);
        return newDate
    }

    // moving average function - not used 
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

});

//hideShowDiv('read_more_div');
function hideShowDiv(id) {
    var e = document.getElementById(id);
    if(e.style.display == 'block')
        e.style.display = 'none';
    else
        e.style.display = 'block';
}