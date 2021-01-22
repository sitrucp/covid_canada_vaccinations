
//GET DATA=================================
// get csv files from working group github repository
var file_dist_prov = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_prov/vaccine_distribution_timeseries_prov.csv";

var file_admin_prov = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_prov/vaccine_administration_timeseries_prov.csv";

var file_dist_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_distribution_timeseries_canada.csv";

var file_admin_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_administration_timeseries_canada.csv";

var file_plan_prov = "https://raw.githubusercontent.com/sitrucp/covid_canada_vaccinations/master/plan_prov.csv";

var file_population = "https://raw.githubusercontent.com/sitrucp/covid_canada_vaccinations/master/population.csv";

var file_update_time = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/update_time.txt";

Promise.all([
    d3.csv(file_dist_prov),
    d3.csv(file_admin_prov),
    d3.csv(file_dist_canada),
    d3.csv(file_admin_canada),
    d3.csv(file_plan_prov),
    d3.csv(file_population),
    d3.csv(file_update_time)
]).then(function(data) {
    //everthing else below is in d3 promise scope

    // get data sets from promise
    var dist_prov = data[0];
    var admin_prov = data[1];
    var dist_canada = data[2];
    var admin_canada = data[3];
    var plan_prov = data[4];
    var population = data[5];
    var updateTime = data[6];

    // get update time from working group repository
    lastUpdated = updateTime.columns[0];
    
    document.getElementById('title').innerHTML += ' <small class="text-muted">Last updated: ' + lastUpdated + '</small>';

    // ggt dist and admin totals by summing values
    var distTotalCanada = dist_canada.reduce((a, b) => +a + +b.dvaccine, 0);
    var adminTotalCanada = admin_canada.reduce((a, b) => +a + +b.avaccine, 0);
    var planTotalCanada = plan_prov.reduce((a, b) => +a + +b.avaccine, 0);

    // filter province population dataset by age_group
    var sel_age_group = 14;
    var populationFiltered = population.filter(function(d) { 
        return parseInt(d.age_group) > parseInt(sel_age_group);
    });
    
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
    plan_prov.forEach(function(d) {
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

    // append planned to actual but only if no actual data for a given date

    // create planned cumulative_avaccine and cumulative_dvaccine


    // get canada dist & admin max dates
    var maxDistDate = d3.max(dist_canada.map(d=>d.report_date));
    var maxAdminDate = d3.max(admin_canada.map(d=>d.report_date));

    function createFutureData(pop, maxDate, dist, admin, prov) {
        // forecast distribution are here: 
        // https://www.canada.ca/en/public-health/services/diseases/2019-novel-coronavirus-infection/prevention-risks/covid-19-vaccine-treatment/vaccine-rollout.html
        // maxDate is max date in original data eg last date reported

        // calculate daysRemaining (# days) eg maxDate to Sep 30
        var daysRemaining = goalDate();

        // create future data
        var futureData = [];
        var province = prov;
        var avaccine_full_req = ((pop * 2) - (admin))
        var dvaccine_full_req = ((pop * 2) - (dist))
        var avaccine = avaccine_full_req / daysRemaining;
        var dvaccine = dvaccine_full_req / daysRemaining;

        // loop through days remaining to create new calculated records
        for (var i=1; i<daysRemaining; i++) { 

            var report_date = new Date(maxDate);
            report_date.setDate(report_date.getDate() + i);
            var cumulative_avaccine = admin + (avaccine * i);
            var cumulative_dvaccine = dist + (dvaccine * i);
            var pct_dist_admin = cumulative_avaccine / cumulative_dvaccine;
            var pct_pop_admin = cumulative_avaccine / pop;
            var pct_pop_dist = cumulative_dvaccine / pop;
            var count_type = 'calculated';

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
    function goalDate() {
        var endDate = new Date("9/30/2021");
        var daysToGoalDate = Math.floor((endDate - maxAdminDate) / (1000*60*60*24))
        return daysToGoalDate
    }

    // assign bar color for actual and calculated y values
    function fillColor(x, maxDate) {
        colors = [];
        for (var i=0; i<x.length; i++) {
            if (Date.parse(x[i]) > Date.parse(maxDate)) {
                colors.push('rgba(204,204,204,1)');
            } else {
                colors.push('rgb(49,130,189)');
            }
        }
        return colors
    }

    function createCanadaChart() {

        // ggt dist and admin totals by summing values, and population using max
        var province = "Canada";
        var max_pct_dist_admin = d3.max(distAdminCanadaPop.map(d=>d.pct_dist_admin));
        var population = d3.max(distAdminCanadaPop.map(d=>d.population));
        var max_pct_dist_admin = d3.max(distAdminCanadaPop.map(d=>d.pct_dist_admin));

        // get future data
        var futureData = createFutureData(popCanada, maxAdminDate, distTotalCanada, adminTotalCanada, province);

        // CREATE CANADA CHART

        // concat actual and future data
        var dataConcat = distAdminCanadaPop.concat(futureData);

        // create x and y axis data sets
        var x = [];
        var yDist = [];
        var yAdmin = [];
        var yPopDist = [];
        var yPopAdmin = [];
        var yDistAdmin = [];

        // create axes x and y arrays
        for (var i=0; i<dataConcat.length; i++) {
            var row = dataConcat[i];
            x.push(row['report_date']);
            yDist.push(parseInt(row['dvaccine']));
            yAdmin.push(parseInt(row['avaccine']));
            yPopDist.push(row['pct_pop_dist']);
            yPopAdmin.push(row['pct_pop_admin']);
            yDistAdmin.push(row['pct_dist_admin']);
        }

        var pctDistAdmin = {
            name: 'pctDistAdmin',
            x: x,
            y: yDistAdmin,
            type: 'bar',
        };
        
        var pctPopAdmin = {
            name: 'pctPopAdmin',
            x: x,
            y: yPopAdmin,
            type: 'bar'
        };

        var pctDistAdmin = {
            name: 'pctPopDist',
            x: x,
            y: yPopDist,
            type: 'bar'
        };
        
        var dist7DMA = {
            name: 'admin7DMA',
            x: x,
            y: movingAverage(yDist, 10),
            type: 'scatter'
        };

        var adminDaily = {
            name: 'adminDaily',
            x: x,
            y: yAdmin,
            showgrid:false,
            fill: 'tozeroy',
            type: 'bar',
            marker:{
                color: fillColor(x, maxAdminDate)
            },
        };

        var admin7DMA = {
            name: 'admin7DMA',
            x: x,
            y: movingAverage(yAdmin, 7),
            type: 'scatter'
        };

        var layout = {
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
                t: 25,
                pad: 2
            },
            title: {
                text:'Canada COVID-19 Vaccine Dose Administration - blue: actual / gray: required to meet Sep 30 goal',
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
        var chartDetails = '<ul class="list-unstyled chart-details"><li><h1>Canada</h1></li><li>Age 15+ Popluation: ' + population.toLocaleString() + '</li><li>Doses Available To-Date: ' + distTotalCanada.toLocaleString() + '</li><li>Doses Administered To-Date: ' + adminTotalCanada.toLocaleString() + '</li><li>' + ((adminTotalCanada/distTotalCanada) * 100).toFixed(1) + '% of Available Doses Administered</li><li>' + ((adminTotalCanada / (population * 2)) * 100).toFixed(2) + '% of Age 15+ Population Doses Administered</li><li>Doses Remaining To Meet Goal: ' + ((population * 2) - adminTotalCanada).toLocaleString() + '</li><li>' + parseInt((((population * 2) - adminTotalCanada) / goalDate())).toLocaleString() + ' doses must be adminstered daily, starting today, to meet Sep 30 goal.</li><li class="font-italic"">Click "Read More" link above for details on calculations.</li></ul>';

        titleCanadaChart.innerHTML  = chartDetails;
        document.getElementById('div_canada_chart').append(titleCanadaChart);
        document.getElementById('div_canada_chart').append(div_canada_chartItem);

        var data = [adminDaily];
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
        for (var i=0; i<provList.length; i++) {

            var provData = distAdminProvPop.filter(function(d) { 
                return d.province === provList[i];
            });

            // ggt dist and admin totals by summing values, and population using max
            var distTotalProv = provData.reduce((a, b) => +a + +b.dvaccine, 0);
            var adminTotalProv = provData.reduce((a, b) => +a + +b.avaccine, 0);
            var population = d3.max(provData.map(d=>d.population));
            var max_pct_dist_admin = d3.max(provData.map(d=>d.pct_dist_admin));

            // get future data 
            var futureData = createFutureData(population, maxAdminDate, distTotalProv, adminTotalProv, provList[i]);

            // concat actual and future data
            var dataConcat = provData.concat(futureData);

            // CREATE PROV CHART
            // create x and y axis data sets
            var x = [];
            var yDist = [];
            var yAdmin = [];
            var yPopDist = [];
            var yPopAdmin = [];
            var yDistAdmin = [];

            // create axes x and y arrays
            for (var j=0; j<dataConcat.length; j++) {
                var row = dataConcat[j];
                x.push(row['report_date']);
                yDist.push(parseInt(row['dvaccine']));
                yAdmin.push(parseInt(row['avaccine']));
                yPopDist.push(row['pct_pop_dist']);
                yPopAdmin.push(row['pct_pop_admin']);
                yDistAdmin.push(row['pct_dist_admin']);
            }

            // create Prov chart
            var pctDistAdmin = {
                name: 'pctDistAdmin',
                x: x,
                y: yDistAdmin,
                type: 'bar',
            };
            
            var pctPopAdmin = {
                name: 'pctPopAdmin',
                x: x,
                y: yPopAdmin,
                type: 'bar'
            };
    
            var pctDistAdmin = {
                name: 'pctPopDist',
                x: x,
                y: yPopDist,
                type: 'bar'
            };
            
            var dist7DMA = {
                name: 'admin7DMA',
                x: x,
                y: movingAverage(yDist, 10),
                type: 'scatter'
            };
    
            var adminDaily = {
                name: 'adminDaily',
                x: x,
                y: yAdmin,
                type: 'bar',
                marker:{
                    color: fillColor(x, maxAdminDate)
                },
            };
    
            var admin7DMA = {
                name: 'admin7DMA',
                x: x,
                y: movingAverage(yAdmin, 7),
                type: 'scatter'
            };

            var layout = {
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
                    t: 25,
                    pad: 2
                },
                title: {
                    text: provList[i] + ' COVID-19 Vaccine Dose Administration - blue: actual / gray: required to meet Sep 30 goal',
                    font: {
                        weight: "bold",
                        size: 14
                    },
                },
            }

            // create divs, para for each province chart
            var provDiv = 'provDiv' + i;
            var provTitle = 'title' + provDiv;
            var titleProvChart = document.createElement("p");
            var div_prov_chartItem = document.createElement("div");
            div_prov_chartItem.id = provDiv;
            titleProvChart.id = provTitle;
            var chartDetails = '<ul class="list-unstyled"><li><h1>' + provList[i] + '</h1></li><li>Age 15+ Popluation: ' + population.toLocaleString() + '</li><li>Doses Available To-Date: ' + distTotalProv.toLocaleString() + '</li><li>Doses Administered To-Date: ' + adminTotalProv.toLocaleString() + '</li><li>' + ((adminTotalProv/distTotalProv) * 100).toFixed(1) + '% of Available Doses Administered</li><li>' + ((adminTotalProv / (population * 2)) * 100).toFixed(2) + '% of Age 15+ Population Doses Administered</li><li>Doses Remaining To Meet Goal: ' + ((population * 2) - adminTotalProv).toLocaleString() + '</li><li>' + parseInt((((population * 2) - adminTotalProv) / goalDate())).toLocaleString() + ' doses must be adminstered daily, starting today, to meet Sep 30 goal.</li><li class="font-italic"">Click "Read More" link above for details on calculations.</li></ul>';

            titleProvChart.innerHTML  = chartDetails;
            document.getElementById('div_prov_chart').append(titleProvChart);
            document.getElementById('div_prov_chart').append(div_prov_chartItem);
            
            var data = [adminDaily];
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