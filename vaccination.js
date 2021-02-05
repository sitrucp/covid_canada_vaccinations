
//GET DATA=================================
// get csv files from working group github repository
var file_dist_prov = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_prov/vaccine_distribution_timeseries_prov.csv";

var file_admin_prov = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_prov/vaccine_administration_timeseries_prov.csv";

var file_dist_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_distribution_timeseries_canada.csv";

var file_admin_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_administration_timeseries_canada.csv";

var file_planned = "https://raw.githubusercontent.com/sitrucp/covid_canada_vaccinations/master/planned.csv";

var file_population = "https://raw.githubusercontent.com/sitrucp/covid_canada_vaccinations/master/population.csv";

var file_update_time = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/update_time.txt";

Promise.all([
    d3.csv(file_dist_prov),
    d3.csv(file_admin_prov),
    d3.csv(file_dist_canada),
    d3.csv(file_admin_canada),
    d3.csv(file_planned),
    d3.csv(file_population),
    d3.csv(file_update_time)
]).then(function(data) {
    //everthing else below is in d3 promise scope

    // get data sets from promise
    var dist_prov = data[0];
    var admin_prov = data[1];
    var dist_canada = data[2];
    var admin_canada = data[3];
    var planned = data[4];
    var population = data[5];
    var updateTime = data[6];

    // get update time from working group repository
    lastUpdated = updateTime.columns[0];
    
    document.getElementById('last_update').innerHTML += ' <small class="text-muted">Last updated: ' + lastUpdated + '</small>';

    // ggt dist and admin totals by summing values
    var distTotalCanada = dist_canada.reduce((a, b) => +a + +b.dvaccine, 0);
    var adminTotalCanada = admin_canada.reduce((a, b) => +a + +b.avaccine, 0);
    var planTotalCanada = planned.reduce((a, b) => +a + +b.avaccine, 0); // use this if planned data is at prov level but currently it is only Canada level

    // filter province population dataset by age_group
    var sel_age_group = '18 years and over';
    var populationFiltered = population.filter(function(d) { 
        return d.age_group == sel_age_group;
    });
    
    // percent population variable, could make user selected eg 100% or 75% etc
    var popPercent = .75;

    // summarize population dataset by Canada
    var popCanada = populationFiltered.reduce((a, b) => +a + +b.population, 0);

    // summarize population dataset by province
    var popProv = d3.nest()
        .key(function(d) { return d.geo; })
        .rollup(function(v) { return {
            population: d3.sum(v, function(d) { return d.population; })
            };
        })
        .entries(populationFiltered)
        .map(function(group) {
            return {
            province: group.key,
            population: group.value.population
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
    planned.forEach(function(d) {
        d.report_date = reformatDate(d.report_date)
        d.prov_date = d.province + '|' + d.report_date
    });

    dist_canada.forEach(function(d) {
        d.report_date = reformatDate(d.date_vaccine_distributed)
        d.prov_date = d.province + '|' + d.date_vaccine_distributed
        d.population = popCanada
    });
    admin_canada.forEach(function(d) {
        d.report_date = reformatDate(d.date_vaccine_administered)
        d.prov_date = d.province + '|' + d.date_vaccine_administered
    });
    //plan_canada.forEach(function(d) {
    //    d.report_date = reformatDate(d.report_date)
    //    d.prov_date = d.province + '|' + d.report_date
    //});

    // left join admin to dist - Canada
    const distAdminCanadaPop = equijoinWithDefault(
        dist_canada, admin_canada, 
        "prov_date", "prov_date", 
        ({province, report_date, dvaccine, cumulative_dvaccine, population}, {avaccine, cumulative_avaccine}, ) => 
        ({province, report_date, dvaccine, cumulative_dvaccine, avaccine, cumulative_avaccine, population}), 
        {prov_date:null, avaccine:"0", cumulative_avaccine:"0"});

    // add percentages to distAdminCanada
    distAdminCanadaPop.forEach(function(d) {
        d.pct_pop_dist = parseInt(d.cumulative_dvaccine) / parseInt(d.population)
        d.pct_pop_admin = parseInt(d.cumulative_avaccine) / parseInt(d.population)
        d.pct_dist_admin = parseInt(d.cumulative_avaccine) / parseInt(d.cumulative_dvaccine)
        d.count_type = 'actual'
    });

    // left join admin to dist - Provinces
    const distAdminProv = equijoinWithDefault(
        dist_prov, admin_prov, 
        "prov_date", "prov_date", 
        ({province, report_date, dvaccine, cumulative_dvaccine}, {avaccine, cumulative_avaccine}, ) => 
        ({province, report_date, dvaccine, cumulative_dvaccine, avaccine, cumulative_avaccine}), 
        {avaccine:"0", cumulative_avaccine:"0"});

    // map population to distAdminProv
    const distAdminProvPop = distAdminProv.map(t1 => ({...t1, ...popProv.find(t2 => t2.province === t1.province)}))

    // add percentages to distAdminProvPop
    distAdminProvPop.forEach(function(d) {
        d.pct_pop_dist = parseInt(d.cumulative_dvaccine) / parseInt(d.population)
        d.pct_pop_admin = parseInt(d.cumulative_avaccine) / parseInt(d.population)
        d.pct_dist_admin = parseInt(d.cumulative_avaccine) / parseInt(d.cumulative_dvaccine)
        d.count_type = 'actual'
    });

    // get canada dist & admin max dates
    var maxDistDate = d3.max(dist_canada.map(d=>d.report_date));
    var maxAdminDate = d3.max(admin_canada.map(d=>d.report_date));

    function createFutureData(popDose, maxDate, dist, admin, prov) {
        // maxDate is max date in original data eg last date reported
        // this is date that future projected data starts

        // calculate daysRemaining (# days) eg maxDate to Sep 30
        var daysRemaining = daysToGoalDate();

        // create future data
        var futureData = [];
        var province = prov;
        var avaccine_full_req = (popDose - admin)
        var dvaccine_full_req = (popDose - dist)
        var avaccine = avaccine_full_req / daysRemaining;
        var dvaccine = dvaccine_full_req / daysRemaining;

        // loop through days remaining to create new calculated records
        for (var i=1; i<daysRemaining; i++) { 

            var report_date = new Date(maxDate);
            report_date.setDate(report_date.getDate() + i);
            var cumulative_avaccine = admin + (avaccine * i);
            var cumulative_dvaccine = dist + (dvaccine * i);
            var pct_dist_admin = cumulative_avaccine / cumulative_dvaccine;
            var pct_pop_admin = cumulative_avaccine / popDose;
            var pct_pop_dist = cumulative_dvaccine / popDose;
            var count_type = 'required';

            futureData.push({
                province,
                report_date, 
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

        return futureData;
    }

    // create days remaining
    function daysToGoalDate() {
        var endDate = new Date("9/30/2021");
        return Math.floor((endDate - maxAdminDate) / (1000*60*60*24))
    }

    // assign bar color for actual and calculated y values
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

    function createCanadaChart() {

        // ggt dist and admin totals by summing values, and population using max
        var province = "Canada";
        var max_pct_dist_admin = d3.max(distAdminCanadaPop.map(d=>d.pct_dist_admin));
        var population = d3.max(distAdminCanadaPop.map(d=>d.population));
        var dosePopulation = parseInt((population * 2) * .75);
        var max_pct_dist_admin = d3.max(distAdminCanadaPop.map(d=>d.pct_dist_admin));

        // get future data
        var futureData = createFutureData(dosePopulation, maxAdminDate, distTotalCanada, adminTotalCanada, province);

        // CREATE CANADA CHART

        // concat actual and future data
        //var dataConcat = distAdminCanadaPop.concat(futureData);

        // concat planned to future
        // var dataConcat = dataConcatFuture.concat(planned);
        // for stacked bar, need multiple trace/data set, one for actual, one for planned, one for projected


        // create x and y axis data sets
        var xActual = [];
        var xFuture = [];
        var xPlan = [];
        var yActual = [];
        var yFuture = [];
        var yPlan = [];

        // create axes x and y arrays
        for (var i=0; i<distAdminCanadaPop.length; i++) {
            var row = distAdminCanadaPop[i];
            xActual.push(row['report_date']);
            yActual.push(parseInt(row['avaccine']));
        }

        for (var i=0; i<futureData.length; i++) {
            var row = futureData[i];
            xFuture.push(row['report_date']);
            yFuture.push(parseInt(row['avaccine']));
        }

        var actual = {
            name: 'Actual Doses',
            x: xActual,
            y: yActual,
            showgrid:false,
            fill: 'tozeroy',
            type: 'bar',
            marker:{
                color: fillColor(xActual, maxAdminDate)
            },
        };

        var future = {
            name: 'Doses To Meet Goal',
            x: xFuture,
            y: yFuture,
            showgrid:false,
            fill: 'tozeroy',
            type: 'bar',
            marker:{
                color: fillColor(xFuture, maxAdminDate)
            },
        };
        
        var plan = {
            name: 'Planned Deliveries',
            x: xPlan,
            y: yPlan,
            showgrid:false,
            fill: 'tozeroy',
            type: 'bar',
            marker:{
                color: fillColor(xPlan, maxAdminDate)
            },
        };

        var layout = {
            //barmode: 'stack',
            showlegend: true,
            legend: {
                "y": 1.04, 
                "x": 0.3,
                legend_title_text: "",
                orientation: "h",
            },
            yaxis: { 
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
            //width: 600,
            //height: 300,
            margin: {
                l: 30,
                r: 40,
                b: 80,
                t: 40,
                pad: 2
            },
            title: {
                text:'Canada COVID-19 Vaccine Dose Administration Required To Meet Sep 30 Goal',
                font: {
                    weight: "bold",
                    size: 14
                },
            },
        }

        // create divs, para for Canada chart
        var canadaDiv = 'canadaDiv';
        var canadaTitle = 'title' + canadaDiv;
        var titleCanadaChart = document.createElement("p");
        var div_canada_chartItem = document.createElement("div");
        div_canada_chartItem.id = canadaDiv;
        titleCanadaChart.id = canadaTitle;
        var chartDetails = '<ul class="list-unstyled chart-details"><li><h4>Canada</h4></li><li>Target Popluation ('+ parseInt(popPercent * 100) + '% Age 18+): ' + dosePopulation.toLocaleString() + '</li><li>Doses Distributed: ' + distTotalCanada.toLocaleString() + '</li><li>Doses Administered: ' + adminTotalCanada.toLocaleString() + '</li><li>' + ((adminTotalCanada/distTotalCanada) * 100).toFixed(1) + '% of Distributed Doses Administered</li><li>' + ((adminTotalCanada / dosePopulation) * 100).toFixed(2) + '% of Target Population Doses Administered</li><li>' + (dosePopulation - adminTotalCanada).toLocaleString() + ' doses remaining to fully vaccinate target population by Sep 30</li><li>' + parseInt(((dosePopulation - adminTotalCanada) / daysToGoalDate())).toLocaleString() + ' doses must be adminstered daily, starting today, to meet Sep 30 goal.</li><li class="font-italic"">Click "Read More" link above for details on calculations.</li></ul>';

        titleCanadaChart.innerHTML  = chartDetails;
        document.getElementById('div_canada_chart').append(titleCanadaChart);
        document.getElementById('div_canada_chart').append(div_canada_chartItem);

        var data = [actual, future];
        Plotly.newPlot('canadaDiv', data, layout);

    }

    function createProvChart() {
        // CREATE PROV CHART

        // get list of provinces 
        provListTemp = [];
        for (var i=0; i<distAdminProvPop.length; i++) {
            province = distAdminProvPop[i]['province'];
            provListTemp.push(province);
        }
        let provList = [...new Set(provListTemp)];

        // create prov charts by loop through provList to create chart for each prov
        for (var j=0; j<provList.length; j++) {

            var provData = distAdminProvPop.filter(function(d) { 
                return d.province === provList[j];
            });

            // ggt dist and admin totals by summing values, and population using max
            var distTotalProv = provData.reduce((a, b) => +a + +b.dvaccine, 0);
            var adminTotalProv = provData.reduce((a, b) => +a + +b.avaccine, 0);
            var population = d3.max(provData.map(d=>d.population));
            var dosePopulation = parseInt((population * 2) * .75);
            var max_pct_dist_admin = d3.max(provData.map(d=>d.pct_dist_admin));

            // get future data 
            var futureData = createFutureData(dosePopulation, maxAdminDate, distTotalProv, adminTotalProv, provList[j]);

            // concat actual and future data
            //var dataConcat = provData.concat(futureData);

            // CREATE PROV CHART
            // create x and y axis data sets
            // create x and y axis data sets
            var xActual = [];
            var xFuture = [];
            var xPlan = [];
            var yActual = [];
            var yFuture = [];
            var yPlan = [];

            // create axes x and y arrays
            for (var i=0; i<provData.length; i++) {
                var row = provData[i];
                xActual.push(row['report_date']);
                yActual.push(parseInt(row['avaccine']));
            }

            for (var i=0; i<futureData.length; i++) {
                var row = futureData[i];
                xFuture.push(row['report_date']);
                yFuture.push(parseInt(row['avaccine']));
            }

            // create Prov chart
            var actual = {
                name: 'Actual Doses',
                x: xActual,
                y: yActual,
                showgrid:false,
                fill: 'tozeroy',
                type: 'bar',
                marker:{
                    color: fillColor(xActual, maxAdminDate)
                },
            };
    
            var future = {
                name: 'Doses To Meet Goal',
                x: xFuture,
                y: yFuture,
                showgrid:false,
                fill: 'tozeroy',
                type: 'bar',
                marker:{
                    color: fillColor(xFuture, maxAdminDate)
                },
            };
            
            var plan = {
                name: 'Planned Deliveries',
                x: xPlan,
                y: yPlan,
                showgrid:false,
                fill: 'tozeroy',
                type: 'bar',
                marker:{
                    color: fillColor(xPlan, maxAdminDate)
                },
            };

            var layout = {
                showlegend: true,
                legend: {
                    "y": 1.04, 
                    "x": 0.3,
                    legend_title_text: "",
                    orientation: "h",
                },
                yaxis: { 
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
                //width: 600,
                //height: 300,
                margin: {
                    l: 30,
                    r: 40,
                    b: 80,
                    t: 40,
                    pad: 2
                },
                title: {
                    text: provList[j] + ' COVID-19 Vaccine Dose Administration Required To Meet Sep 30 Goal',
                    font: {
                        weight: "bold",
                        size: 14
                    },
                },
            }

            // create divs, para for each province chart
            var provDiv = 'provDiv' + j;
            var provTitle = 'title' + provDiv;
            var titleProvChart = document.createElement("p");
            var div_prov_chartItem = document.createElement("div");
            div_prov_chartItem.id = provDiv;
            titleProvChart.id = provTitle;
            var chartDetails = '<ul class="list-unstyled"><li><h4>' + provList[j] + '</h4></li><li>Target Popluation ('+ parseInt(popPercent * 100) + '% Age 18+): ' + dosePopulation.toLocaleString() + '</li><li>Doses Distributed: ' + distTotalProv.toLocaleString() + '</li><li>Doses Administered: ' + adminTotalProv.toLocaleString() + '</li><li>' + ((adminTotalProv/distTotalProv) * 100).toFixed(1) + '% of Distributed Doses Administered</li><li>' + ((adminTotalProv / dosePopulation) * 100).toFixed(2) + '% of Target Population Doses Administered</li><li>' + (dosePopulation - adminTotalProv).toLocaleString() + ' doses remaining to fully vaccinate target population by Sep 30.</li><li>' + parseInt(((dosePopulation - adminTotalProv) / daysToGoalDate())).toLocaleString() + ' doses must be adminstered daily, starting today, to meet Sep 30 goal.</li><li class="font-italic"">Click "Read More" link above for details on calculations.</li></ul>';

            titleProvChart.innerHTML  = chartDetails;
            document.getElementById('div_prov_chart').append(titleProvChart);
            document.getElementById('div_prov_chart').append(div_prov_chartItem);
            
            var data = [actual, future];
            Plotly.newPlot(provDiv, data, layout);

        }
    }

     // create charts
    // call createCharts when page loads
    createCanadaChart();
    createProvChart();

});

// left join function used to join datasets
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

//hideShowDiv('read_more_div');

function hideShowDiv(id) {
   var e = document.getElementById(id);
   if(e.style.display == 'block')
      e.style.display = 'none';
   else
      e.style.display = 'block';
}