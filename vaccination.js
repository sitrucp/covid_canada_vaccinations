
// get files from ccodwg github repository 
var file_dist_prov = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_prov/vaccine_distribution_timeseries_prov.csv";
var file_admin_prov = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_prov/vaccine_administration_timeseries_prov.csv";
var file_dist_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_distribution_timeseries_canada.csv";
var file_admin_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_administration_timeseries_canada.csv";
var file_update_time = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/update_time.txt";

// get files from my github repository
var file_forecast = "forecast.csv";
var file_population = "population.csv";

// promise data from sources
Promise.all([
    d3.csv(file_dist_prov),
    d3.csv(file_admin_prov),
    d3.csv(file_dist_canada),
    d3.csv(file_admin_canada),
    d3.csv(file_forecast),
    d3.csv(file_population),
    d3.csv(file_update_time)
]).then(function(data) {
    //everthing else below is in promise scope

    // get data from promise
    var arrDistProv = data[0];
    var arrAdminProv = data[1];
    var arrDistCanada = data[2];
    var arrAdminCanada = data[3];
    var arrForecast = data[4];
    var arrPopulation = data[5];
    var updateTime = data[6];

    // get ccodwg last updated datetime
    lastUpdated = updateTime.columns[0];
    
    // write ccodwg last update datetime
    document.getElementById('last_update').innerHTML += ' <small class="text-muted">Data updated: ' + lastUpdated + '</small>';

    // ggt dist and admin totals by summing array values
    var distCanadaTotal = arrDistCanada.reduce((a, b) => +a + +b.dvaccine, 0);
    var adminCanadaTotal = arrAdminCanada.reduce((a, b) => +a + +b.avaccine, 0);

    // define color variables 
    var clrBlue = 'rgba(49,130,189,.9)';
    var clrGray = 'rgba(204,204,204,.9)';
    var clrBlack = 'rgba(0,0,0,.9)';
    var clrWhiteTransparent = 'rgba(255,255,255,0)';
    var clr1 = 'rgba(55, 6, 23,.5)';
    var clr2 = 'rgba(189,0,38,.6)';
    var clr3 = 'rgba(240,59,32,.6)';
    var clr4 = 'rgba(253,141,60,.6)';

    // define percent population variable. in future, could do dynamic user variable eg to see 70% pop instead of 100% (herd immunity)
    var popPercent = 1;

    // filter province arrPopulation dataset by age_group
    var sel_age_group = '16 years and over';
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


    // CREATE CHART
    function createCanadaActualChart() {

        // create variables
        var province = "Canada";

        // define x and y axis arrays
        var xAdmin = [];
        var yAdmin = [];
        var xAdminCum = [];
        var yAdminCum = [];
        var xDistCum = [];
        var yDistCum = [];

        // populate x and y axis arrays
        for (var i=0; i<arrDistAdminCanadaPop.length; i++) {
            var row = arrDistAdminCanadaPop[i];
            xAdmin.push(row['report_date']);
            yAdmin.push(parseInt(row['avaccine']));
        }

        for (var i=0; i<arrDistAdminCanadaPop.length; i++) {
            var row = arrDistAdminCanadaPop[i];
            xAdminCum.push(row['report_date']);
            yAdminCum.push(parseInt(row['cumulative_avaccine']));
        }

        for (var i=0; i<arrDistAdminCanadaPop.length; i++) {
            var row = arrDistAdminCanadaPop[i];
            xDistCum.push(row['report_date']);
            yDistCum.push(parseInt(row['cumulative_dvaccine']));
        }

        // create chart traces
        var trAdmin = {
            name: 'Administered',
            hoverlabel: {
                namelength :-1
            },
            x: xAdmin,
            y: yAdmin,
            showgrid: false,
            type: 'bar',
            marker:{
                color: clrBlue
            },
        };

        var trAdminCum = {
            name: 'Administered Cumulative',
            hoverlabel: {
                namelength :-1
            },
            yaxis: 'y2',
            x: xAdminCum,
            y: yAdminCum,
            showgrid: false,
            mode: 'line',
            line: {
                dash: 'solid',
                width: 1
            },
            marker:{
                color: clrBlack
            },
        };

        var trDistCum = {
            name: 'Distributed Cumulative',
            hoverlabel: {
                namelength :-1
            },
            yaxis: 'y2',
            x: xDistCum,
            y: yDistCum,
            showgrid: false,
            line: {
                dash: 'dot',
                width: 1
            },
            marker:{
                color: clrBlack
            },
        };

        // create chart layout
        var layout = {
            title: {
                text:'Canada COVID-19 Vaccine Actual Doses <br> Distributed and Administered',
                font: {
                    size: 14
                },
            },
            barmode: 'relative',
            autosize: true,
            autoscale: false,
            //width: 800,
            height: 600,
            margin: {
                l: 40,
                r: 40,
                b: 40,
                t: 200
            },
            showlegend: true,
            legend: {
                "y": 1.2, 
                "x": 0.15,
                legend_title_text: "",
                orientation: "h",
                bgcolor: clrWhiteTransparent
            },
            xaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false,
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
                showgrid: false,
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
            }
        }

        // create chart section text content
        var canadaActualDiv = 'canadaActualDiv';
        var canadaActualTitle = 'title' + canadaActualDiv;
        var titleCanadaActualChart = document.createElement("p");
        var div_canada_Actual_chartItem = document.createElement("div");
        div_canada_Actual_chartItem.id = canadaActualDiv;
        titleCanadaActualChart.id = canadaActualTitle;
        var chartDetails = '<ul class="list-unstyled"><li><h4>' + province + ' - Actual Doses Distributed and Administered</h4>' +
            '<p>The visualization below shows actual daily and cumulative vaccine doses distributed and administered.</p>' + 
            '<li>Doses Distributed: ' + distCanadaTotal.toLocaleString() + '</li>' +
            '<li>Doses Administered: ' + adminCanadaTotal.toLocaleString() + '</li>' +
            '<li>Distributed Doses Administered: ' + ((adminCanadaTotal/distCanadaTotal) * 100).toFixed(1) + '%</li>' +
            '<li class="small font-italic"">Click "Read More" link above for details on calculations.</li>' +
            '</ul>';
        titleCanadaActualChart.innerHTML  = chartDetails;
        document.getElementById('div_canada_actual_chart').append(titleCanadaActualChart);
        document.getElementById('div_canada_actual_chart').append(div_canada_Actual_chartItem);

        // create plotly data, config, chart
        var data = [trAdmin, trAdminCum, trDistCum];
        var config = {responsive: true}
        Plotly.newPlot('canadaActualDiv', data, layout, config);

    }

    // CREATE CHART
    function createCanadaForecastChart() {

        // define location
        var province = "Canada";
        
        // define x and y axis arrays
        var xActual = [];
        var yActual = [];
        var xPfizer = [];
        var yPfizer = [];
        var xModerna = [];
        var yModerna = [];
        var xAstra = [];
        var yAstra = [];
        var xJJ = [];
        var yJJ = [];
        var xCumForecast = [];
        var yCumForecast = [];
        var xCumActual = [];
        var yCumActual = [];

        // populate x and y axis arrays
        for (var i=0; i<arrDistAdminCanadaPop.length; i++) {
            var row = arrDistAdminCanadaPop[i];
            xActual.push(row['report_date']);
            yActual.push(parseInt(row['dvaccine']));
            xCumActual.push(row['report_date']);
            yCumActual.push(parseInt(row['cumulative_dvaccine']));
        }

        for (var i=0; i<arrForecast.length; i++) {
            var row = arrForecast[i];
            xPfizer.push(row['report_date']);
            yPfizer.push(parseInt(row['daily_pfizer'].replace(/,/g, '')));
            xModerna.push(row['report_date']);
            yModerna.push(parseInt(row['daily_moderna'].replace(/,/g, '')));
            xAstra.push(row['report_date']);
            yAstra.push(parseInt(row['daily_astra'].replace(/,/g, '')));
            xJJ.push(row['report_date']);
            yJJ.push(parseInt(row['daily_jj'].replace(/,/g, '')));
            xCumForecast.push(row['report_date']);
            yCumForecast.push(parseInt(row['cumulative_total'].replace(/,/g, '')));
        }

        // get current yCumForecast value, by get xCumForecast current date index, then find yCumForecast value at that index
        var currDateIndex = xCumForecast.findIndex(x => x.toISOString().split('T')[0] === maxAdminDate.toISOString().split('T')[0]);
        var maxCumForecast = yCumForecast[currDateIndex];
        // get max yCumActual value
        var maxCumActual = Math.max(...yCumActual);
        // create string for diff between forecast and actual
        var netCum = parseInt(maxCumActual) - parseInt(maxCumForecast);

        // create chart traces
        var trActual = {
            name: 'Actual',
            hoverlabel: {
                namelength :-1
            },
            x: xActual,
            y: replaceZeros(yActual),
            showgrid: false,
            mode: 'markers',
            type: 'bar',
            base: 0, // exclude trace from stacking
            //width: .5*1000*3600*24, // x axis date multiply width by ms, exclude for bargap 0
            marker: {
                color: clrBlue,
                size: 5
            },
        };
        
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
                color: clr1
            },
        };

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
                color: clr2
            },
        };

        var trAstra = {
            name: 'AstraZenaca Forecast',
            hoverlabel: {
                namelength :-1
            },
            x: xAstra,
            y: yAstra,
            showgrid: false,
            type: 'bar',
            marker:{
                color: clr3
            },
        };

        var trJJ = {
            name: 'J & J Forecast',
            hoverlabel: {
                namelength :-1
            },
            x: xJJ,
            y: yJJ,
            showgrid: false,
            type: 'bar',
            marker:{
                color: clr4
            },
        };

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
                width: 1
            },
            marker:{
                color: clrBlack
            },
        };

        var trCumActual = {
            name: 'Actual Cumulative',
            hoverlabel: {
                namelength :-1
            },
            yaxis: 'y2',
            x: xCumActual,
            y: yCumActual,
            showgrid: false,
            line: {
                width: 1
            },
            marker:{
                color: clrBlack
            },
        };

         // create chart layout
        var layout = {
            title: {
                text:'Canada COVID-19 Vaccine Distribution <br> Actual vs Forecast Doses By Sep 30',
                font: {
                    size: 14
                },
            },
            barmode: 'relative',
            bargap: 0,
            //width: 800,
            height: 620,
            showlegend: true,
            autosize: true,
            autoscale: false,
            margin: {
                l: 40,
                r: 40,
                b: 40,
                t: 300
            },
            legend: {
                xanchor: "none",
                yanchor: "none",
                "y": 1.47, 
                "x": 0.10,
                legend_title_text: "",
                orientation: "h",
                bgcolor: clrWhiteTransparent
            },
            xaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false,
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
                showgrid: false,
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
            annotations: [ 
                {
                    x: new Date(("03/31/2021")).getTime(),
                    y: getAnnoMilestoneY(xCumForecast, yCumForecast, new Date("03/31/2021")),
                    text: 'Mar 31<br>' + getAnnoMilestoneText(xCumActual, xCumForecast, yCumActual, yCumForecast, new Date("03/31/2021")),
                    font: {
                        color: "#000",
                        size: 10
                    },
                    bgcolor: '#fff',
                    opacity: 0.7,
                    xref: 'x',
                    yref: 'y2',
                    showarrow: true,
                    arrowhead: 5,
                    arrowsize: 1,
                    arrowcolor: "rgba(0,0,0,.5)",
                    ax: -15,
                    ay: -105
                },
                {
                    x: new Date(("06/30/2021")).getTime(),
                    y: getAnnoMilestoneY(xCumForecast, yCumForecast, new Date("06/30/2021")),
                    text: 'Jun 30<br>' + getAnnoMilestoneText(xCumActual, xCumForecast, yCumActual,yCumForecast, new Date("06/30/2021")),
                    font: {
                        color: "#000",
                        size: 10
                    },
                    bgcolor: '#fff',
                    opacity: 0.7,
                    xref: 'x',
                    yref: 'y2',
                    showarrow: true,
                    arrowhead: 5,
                    arrowsize: 1,
                    arrowcolor: "rgba(0,0,0,.5)",
                    ax: -45,
                    ay: -75
                },
                {
                    x: new Date(("09/30/2021")).getTime(),
                    y: getAnnoMilestoneY(xCumForecast, yCumForecast, new Date("09/30/2021")),
                    text: 'Sep 30<br>' + getAnnoMilestoneText(xCumActual, xCumForecast, yCumActual, yCumForecast, new Date("09/30/2021")),
                    font: {
                        color: "#000",
                        size: 10
                    },
                    bgcolor: '#fff',
                    opacity: 0.7,
                    xref: 'x',
                    yref: 'y2',
                    showarrow: true,
                    arrowhead: 5,
                    arrowsize: 1,
                    arrowcolor: "rgba(0,0,0,.5)",
                    ax: -100,
                    ay: 20
                },
                {
                    x: getAnnoFullVaxX(xCumForecast, yCumForecast, 61000000),
                    y: 61000000,
                    text: '16+ full vaccination<br>(61m) ' + getAnnoFullVaxText(xCumForecast, yCumForecast, 61000000),
                    font: {
                        color: "#000",
                        size: 10
                    },
                    bgcolor: '#fff',
                    opacity: 0.7,
                    xref: 'x',
                    yref: 'y2',
                    showarrow: true,
                    arrowhead: 3,
                    arrowsize: 1,
                    arrowcolor: "rgba(0,0,0,.5)",
                    ax: -50,
                    ay: -60
                },
            ]
        }

        // create chart section text content
        var canadaForecastDiv = 'canadaForecastDiv';
        var canadaForecastTitle = 'title' + canadaForecastDiv;
        var titleCanadaForecastChart = document.createElement("p");
        var div_canada_forecast_chartItem = document.createElement("div");
        div_canada_forecast_chartItem.id = canadaForecastDiv;
        titleCanadaForecastChart.id = canadaForecastTitle;
        var chartDetails = '<h4>' + province + ' - Actual vs Forecast Dose Distribution</h4>' + 
            '<p>The visualization below shows a vaccine dose distribution forecast model vs actual distributions. It includes Government of Canada (GoC) distribution milestone targets presented as daily forecast vaccine dose distributions.</p>' +
            '<p>Forecast regularly updated to include most recent <a href = "https://www.canada.ca/en/public-health/services/diseases/2019-novel-coronavirus-infection/prevention-risks/covid-19-vaccine-treatment/vaccine-rollout.html" target="blank">Public Health Roll-Out details</a>. <a href="forecast.csv" download> Download detailed forecast csv.</a></p>' +
            '<div class="row">' +
                '<div class="col-sm box-value">' +
                    '<ul class="list-unstyled">' + 
                    '<li class="font-weight-bold">Dec 14-Mar 31</li>' +
                        '<li>Total 8 m:</li>' +
                        '<li>* Pfizer 5.5 m</li>' +
                        '<li>* Moderna 2 m</li>' +
                        '<li>* AstraZenaca 2 m</li>' +
                        '<li>* Johnson & Johnson 0 </li>' +
                    '</ul>' +
                    '<p>Cumulative total: 9.5 m</p>' +
                '</div>' + 
                '<div class="col-sm box-value">' +
                    '<ul class="list-unstyled">' +
                        '<li class="font-weight-bold">Apr 1-Jun 30</li>' +
                        '<li>Total 28.5 m:</li>' +
                        '<li>* Pfizer 12.8 m</li>' +
                        '<li>* Moderna 12.2 m</li>' +
                        '<li>* AstraZenaca 3.5 m</li>' +
                        '<li>* Johnson & Johnson 0 </li>' +
                    '</ul>' +
                    '<p>Cumulative total: 38 m</p>' +
                '</div>' + 
                '<div class="col-sm box-value">' +
                    '<ul class="list-unstyled">' + 
                        '<li class="font-weight-bold">Jul 1-Sep 30</li>' +
                        '<li>Total 77.5 m:</li>' +
                        '<li>* Pfizer 21.7 m</li>' +
                        '<li>* Moderna 29.8 m</li>' +
                        '<li>* AstraZenaca 16 m</li>' +
                        '<li>* Johnson & Johnson 10 m</li>' +
                    '</ul>' +
                    '<p>Cumulative total: 115.5 m</p>' +
                '</div>' + 
            '</div>' + 

            '<p>Vaccine distribution is on-track when the actual cumulative distribution closely tracks or overtakes forecast cumulative distribution and when the actual cumulative distribution closely tracks or overtakes forecast cumulative distribution.</p>' +

            '<p class="font-weight-bold">Cumulative Dose Distribution as of: ' + maxAdminDate.toISOString().split('T')[0] +'</p>' +
            '<div class="row">' +
                '<div class="col-sm box-value">' +
                    '<p><span class="font-weight-bold">Actual</span> <br>' + maxCumActual.toLocaleString() + '</p>' +
                '</div>' + 
                '<div class="col-sm box-value">' +
                    '<p><span class="font-weight-bold">Forecast</span> <br>' + maxCumForecast.toLocaleString() + '</p>' +
                '</div>' + 
                '<div class="col-sm box-value">' +
                    '<p><span class="font-weight-bold">Actual minus Forecast</span> <br>' + netCum.toLocaleString() + '</p>' +
                '</div>' + 
            '</div>';
        titleCanadaForecastChart.innerHTML = chartDetails;
        document.getElementById('div_canada_forecast_chart').append(titleCanadaForecastChart);
        document.getElementById('div_canada_forecast_chart').append(div_canada_forecast_chartItem);

        // create plotly data, config, chart
        var data = [trActual, trPfizer, trModerna, trAstra, trJJ, trCumActual, trCumForecast];
        var config = {responsive: true}
        Plotly.newPlot('canadaForecastDiv', data, layout, config);

    }

    // CREATE CHART
    function createCanadaRemainingChart() {

        // create chart section variables
        var province = "Canada";
        var population = d3.max(arrDistAdminCanadaPop.map(d=>d.population));
        var dosePopulation = parseInt((population * 2) * popPercent);

        // get future data
        var arrRemaining = createRemaining(dosePopulation, maxAdminDate, distCanadaTotal, adminCanadaTotal, province);

        // left join arrRemaining to arrForecast
        const arrRemainForecast = equijoinWithDefault(
            arrRemaining, arrForecast, 
            "prov_date", "prov_date", 
            ({province, report_date, prov_date, count_type, avaccine, dvaccine}, {daily_moderna, daily_pfizer, daily_astra, daily_jj, daily_total, cumulative_total}, ) => 
            ({province, report_date, prov_date, count_type, avaccine, dvaccine, daily_moderna, daily_pfizer, daily_astra, daily_jj, daily_total, cumulative_total}), 
            {daily_moderna:"0", daily_pfizer:"0", daily_astra:"0", daily_jj:"0", daily_total:"0", cumulative_total:"0"});
            
        // create new 'required' value for future minus remaining, if any remaining
        arrRemainForecast.forEach(function(d) {
            d.required = parseInt(d.avaccine);
            if ( parseInt(d.daily_total.replace(/,/g, '')) < parseInt(d.avaccine)) {
                d.required = parseInt(d.avaccine) - parseInt(d.daily_total.replace(/,/g, ''));
            } else {
                d.required = 0;
            }
        });

        // define x and y axis arrays
        var xActual = [];
        var yActual = [];
        var xRemain = [];
        var yRemain = [];

        // populate x and y axis arrays
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

        // create chart traces
        var trActual = {
            name: 'Actual',
            x: xActual,
            y: yActual,
            showgrid: false,
            type: 'bar',
            marker:{
                color: fillColor(xActual, maxAdminDate)
            },
        };

        var trFuture = {
            name: 'Remaining',
            x: xRemain,
            y: yRemain,
            showgrid: false,
            type: 'bar',
            marker:{
                color: clrGray
                //color: fillColor(xRemain, maxAdminDate)
            },
        };

        // create chart layout
        var layout = {
            title: {
                text:'Canada COVID-19 Vaccine Administration <br> Actual vs Remaining Doses <br>To Meet Sep 30 Goal',
                font: {
                    size: 14
                },
            },
            barmode: 'relative',
            autosize: true,
            autoscale: false,
            margin: {
                l: 40,
                r: 40,
                b: 40,
                t: 120
            },
            showlegend: true,
            legend: {
                "y": 1.06, 
                "x": 0.3,
                legend_title_text: "",
                orientation: "h",
                bgcolor: clrWhiteTransparent
            },
            xaxis: { 
                tickfont: {
                    size: 11
                },
                showgrid: false,
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
                showgrid: false
            }
        }

        // create chart section text content
        var canadaDiv = 'canadaDiv';
        var canadaTitle = 'title' + canadaDiv;
        var titleCanadaChart = document.createElement("p");
        var div_canada_chartItem = document.createElement("div");
        div_canada_chartItem.id = canadaDiv;
        titleCanadaChart.id = canadaTitle;
        var chartDetails = '<ul class="list-unstyled"><li><h4>' + province + ' - Actual vs Remaining Dose Administration</h4>' +
            '</li><li>Target Popluation ('+ parseInt(popPercent * 100) + '% Age 16+): ' + population.toLocaleString() + '</li>' + 
            '<li>Doses Distributed: ' + distCanadaTotal.toLocaleString() + '</li>' +
            '<li>Doses Administered: ' + adminCanadaTotal.toLocaleString() + '</li>' +
            '<li>Distributed Doses Administered: ' + ((adminCanadaTotal/distCanadaTotal) * 100).toFixed(1) + '%</li>' +
            '<li>Doses Required To Fully Vaccinate Target Pop: ' + (dosePopulation).toLocaleString() + '</li>' +
            '<li>Doses Remaining To Fully Vaccinate Target Pop: ' + (dosePopulation - adminCanadaTotal).toLocaleString() + ' </li>' +
            '<li>Target Population Doses Administered: ' + ((adminCanadaTotal / dosePopulation) * 100).toFixed(2) + '%</li>' +
            '<li>' + parseInt(((dosePopulation - adminCanadaTotal) / daysToGoalDate())).toLocaleString() + ' doses must be adminstered daily, starting today, to meet Sep 30 goal.</li>' +
            '<li class="small font-italic"">Click "Read More" link above for details on calculations.</li>' +
            '</ul>'  +
            '<p>The visualization below compares the actual count of vaccine doses administered to-date across Canada as reported by provinces (blue bars) vs calculated remaining dose administration required to fully vaccinate age 16+ population by Sep 30, 2021 (gray bars).</p>';
        titleCanadaChart.innerHTML  = chartDetails;
        document.getElementById('div_canada_remain_chart').append(titleCanadaChart);
        document.getElementById('div_canada_remain_chart').append(div_canada_chartItem);

        // create plotly data, config, chart
        var data = [trActual, trFuture];
        var config = {responsive: true}
        Plotly.newPlot('canadaDiv', data, layout, config);

    }

    // CREATE CHARTS
    function createProvRemainingCharts() {

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

            // define x and y axis arrays
            var xActual = [];
            var xRemain = [];
            var yActual = [];
            var yRemain = [];

            // populate x and y axis arrays
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

            // create chart traces
            var trActual = {
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
    
            var trFuture = {
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
            
            // create chart layout
            var layout = {
                title: {
                    text: provList[j] + ' COVID-19 Vaccine Administration <br> Actual vs Remaining Doses <br> To Meet Sep 30 Goal',
                    font: {
                        size: 14
                    },
                },
                autosize: true,
                autoscale: false,
                margin: {
                    l: 40,
                    r: 40,
                    b: 40,
                    t: 120
                },
                showlegend: true,
                legend: {
                    "y": 1.06,
                    "x": 0.3,
                    legend_title_text: "",
                    orientation: "h",
                    bgcolor: clrWhiteTransparent
                },
                xaxis: { 
                    tickfont: {
                        size: 11
                    },
                    showgrid: false
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
                    showgrid: false
                }
            }

            // create chart section text content
            var provDiv = 'provDiv' + j;
            var provTitle = 'title' + provDiv;
            var titleProvChart = document.createElement("p");
            var div_prov_chartItem = document.createElement("div");
            div_prov_chartItem.id = provDiv;
            titleProvChart.id = provTitle;
            var chartDetails = '<ul class="list-unstyled"><li><h4>' + provList[j] + ' - Actual vs Remaining Dose Administration</h4>' +
                '</li><li>Target Popluation ('+ parseInt(popPercent * 100) + '% Age 16+): ' + population.toLocaleString() + '</li>' + 
                '<li>Doses Distributed: ' + distTotalProv.toLocaleString() + '</li>' +
                '<li>Doses Administered: ' + adminTotalProv.toLocaleString() + '</li>' +
                '<li>Distributed Doses Administered: ' + ((adminTotalProv/distTotalProv) * 100).toFixed(1) + '%</li>' +
                '<li>Doses Required To Fully Vaccinate Target Pop: ' + (dosePopulation).toLocaleString() + '</li>' +
                '<li>Doses Remaining To Fully Vaccinate Target Pop: ' + (dosePopulation - adminTotalProv).toLocaleString() + ' </li>' +
                '<li>Target Population Doses Administered: ' + ((adminTotalProv / dosePopulation) * 100).toFixed(2) + '%</li>' +
                '<li>' + parseInt(((dosePopulation - adminTotalProv) / daysToGoalDate())).toLocaleString() + ' doses must be adminstered daily, starting today, to meet Sep 30 goal.</li>' +
                '<li class="small font-italic"">Click "Read More" link above for details on calculations.</li>' +
                '</ul>' +
                '<p>The visualization below compares the actual count of vaccine doses administered to-date as reported by ' + provList[j] + ' (blue bars) vs calculated remaining dose administration required to fully vaccinate age 16+ population by Sep 30, 2021 (gray bars).</p>';
            titleProvChart.innerHTML  = chartDetails;
            document.getElementById('div_prov_remain_chart').append(titleProvChart);
            document.getElementById('div_prov_remain_chart').append(div_prov_chartItem);
            
            // plotly data, config, create chart
            var data = [trActual, trFuture];
            var config = {responsive: true}
            Plotly.newPlot(provDiv, data, layout, config);

        }
    }

    // create charts when page loads
    createCanadaActualChart();
    createCanadaForecastChart();
    createCanadaRemainingChart();
    createProvRemainingCharts();

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
                colors.push(clrGray); // gray
            } else {
                colors.push(clrBlue); // blue
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
    function reformatDate(d) {
        // 17-12-2020 is working group date format
        var parts = (d).split('-');
        var newDate = new Date(parts[1] + '/' + parts[0] + '/' + parts[2]);
        return newDate
    }

    function getAnnoMilestoneY(arrX, arrY, d) {
        xIndex = arrX.findIndex(x => x.toISOString().split('T')[0] === d.toISOString().split('T')[0]);
        return arrY[xIndex];
    }
    
    function getAnnoMilestoneText(arrXactual, arrXforecast, arrYactual, arrYforecast, d) {
        // get index for desired date
        xIndexActual = arrXactual.findIndex(x => x.toISOString().split('T')[0] === d.toISOString().split('T')[0]);
        xIndexForecast = arrXforecast.findIndex(x => x.toISOString().split('T')[0] === d.toISOString().split('T')[0]);
        // use index to get actual cumulative
        var yActual = arrYactual[xIndexActual];
        // use index to get forecast cumulative
        var yForecast = arrYforecast[xIndexForecast];
        if (yActual) {
            strActual = 'Actual: ' + (yActual / 1000000).toFixed(1) + 'm<br>';
        } else {
            strActual = '';
        }
        strForecast = 'Forecast: ' + (yForecast / 1000000).toFixed(1) + 'm';
        annoString = strActual + strForecast;
        return annoString;
    }

    function getAnnoFullVaxX(arrX, arrY, yValue) {
        var yIndex = arrY.findIndex(x => x > yValue)
        return arrX[yIndex];
    }

    function getAnnoFullVaxText(arrXforecast, arrYforecast, yValue) {
        // get index for first value greater than yValue
        var yIndexForecast = arrYforecast.findIndex(x => x > yValue)
        // get x value for y index
        var xForecast = arrXforecast[yIndexForecast].toLocaleString('en-us',{month:'short', day:'numeric'});
        return xForecast;
    }

});

// hide show read_more_div 
function hideShowDiv(id) {
    var e = document.getElementById(id);
    if(e.style.display == 'block')
        e.style.display = 'none';
    else
        e.style.display = 'block';
}