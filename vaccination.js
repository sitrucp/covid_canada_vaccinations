
//GET DATA=================================
// get csv files from working group github repository
var file_dist_prov = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_prov/vaccine_distribution_timeseries_prov.csv";

var file_admin_prov = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_prov/vaccine_administration_timeseries_prov.csv";

var file_dist_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_distribution_timeseries_canada.csv";

var file_admin_canada = "https://raw.githubusercontent.com/ishaberry/Covid19Canada/master/timeseries_canada/vaccine_administration_timeseries_canada.csv";

var file_population = "https://raw.githubusercontent.com/sitrucp/covid_canada_vaccinations/master/population.csv";

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

    // ggt dist and admin totals by summing values
    var distTotalCanada = dist_canada.reduce((a, b) => +a + +b.dvaccine, 0);
    var adminTotalCanada = admin_canada.reduce((a, b) => +a + +b.avaccine, 0);

    //==== population data start ====
    // filter population by age_group
    var sel_age_group = 14;
    var populationFiltered = population.filter(function(d) { 
        return parseInt(d.age_group) > parseInt(sel_age_group);
    });
    
    // summarize population by Canada
    var popCanada = populationFiltered.reduce((a, b) => +a + +b.population, 0);

    // summarize population by province
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
    //==== population data end ====

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
        d.population = popCanada
    });
    admin_canada.forEach(function(d) {
        d.report_date = reformatDate(d.date_vaccine_administered)
        d.prov_date = d.province + '|' + d.date_vaccine_administered
    });
    
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
    });

    // create charts
    // call createCharts when page loads, or when user changes age filter

    // get canada dist & admin max dates
    var maxDistDate = d3.max(dist_canada.map(d=>d.report_date));
    var maxAdminDate = d3.max(admin_canada.map(d=>d.report_date));

    function createFutureData(pop, maxDate, dist, admin, prov) {
        // forecast distribution are here: 
        // https://www.canada.ca/en/public-health/services/diseases/2019-novel-coronavirus-infection/prevention-risks/covid-19-vaccine-treatment/vaccine-rollout.html

        // calculate daysRemaining (# days) eg maxDate to Sep 30
        var datex = maxDate.split('-');
        var startDate = new Date(datex[1] + '/' + datex[2] + '/' + datex[0]);
        var endDate = new Date("9/30/2021");
        var daysRemaining = Math.floor((endDate - startDate) / (1000*60*60*24))

        // create future data
        var futureData = [];
        var province = prov;
        var avaccine = ((pop * 2) - (admin)) / daysRemaining;
        var dvaccine = ((pop * 2) - (dist)) / daysRemaining;

        for (var i=1; i<daysRemaining; i++) {
            var report_date = new Date(startDate);
            report_date.setDate(report_date.getDate() + i);
            var cumulative_avaccine = admin + (avaccine * i);
            var cumulative_dvaccine = dist + (dvaccine * i);
            var pct_dist_admin = cumulative_avaccine / cumulative_dvaccine;
            var pct_pop_admin = cumulative_avaccine / pop;
            var pct_pop_dist = cumulative_dvaccine / pop;

            futureData.push({
                province, 
                report_date, 
                avaccine, 
                dvaccine, 
                cumulative_avaccine, 
                cumulative_dvaccine, 
                pct_dist_admin,
                pct_pop_admin,
                pct_pop_dist
            });
        }
        return futureData;
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
            type: 'bar'
        };

        var admin7DMA = {
            name: 'admin7DMA',
            x: x,
            y: movingAverage(yAdmin, 7),
            type: 'scatter'
        };

        // create divs, para for Canada chart
        var canadaDiv = 'canadaDiv';
        var canadaTitle = 'title' + canadaDiv;
        var titleCanadaChart = document.createElement("p");
        var divCanadaChartItem = document.createElement("div");
        divCanadaChartItem.id = canadaDiv;
        titleCanadaChart.id = canadaTitle;
        var chartDetails = '<ul class="list-unstyled"><li><h1>Canada</h1></li><li>Popluation: ' + population + '</li><li>Received: ' + distTotalCanada + '</li><li>Administered: ' + adminTotalCanada + '</li><li>% Administered: ' + max_pct_dist_admin + '</li></ul>';

        titleCanadaChart.innerHTML  = chartDetails;
        document.getElementById('divCanadaChart').append(titleCanadaChart);
        document.getElementById('divCanadaChart').append(divCanadaChartItem);

        var data = [adminDaily];
        Plotly.newPlot('canadaDiv', data);

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
        console.log(provList);

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
                type: 'bar'
            };
    
            var admin7DMA = {
                name: 'admin7DMA',
                x: x,
                y: movingAverage(yAdmin, 7),
                type: 'scatter'
            };

            // create divs, para for each province chart
            var provDiv = 'provDiv' + i;
            var provTitle = 'title' + provDiv;
            var titleProvChart = document.createElement("p");
            var divProvChartItem = document.createElement("div");
            divProvChartItem.id = provDiv;
            titleProvChart.id = provTitle;
            var chartDetails = '<ul class="list-unstyled"><li><h1>' + provList[i] + '</h1></li><li>Popluation: ' + population + '</li><li>Received: ' + distTotalProv + '</li><li>Administered: ' + adminTotalProv + '</li><li>% Administered: ' + max_pct_dist_admin + '</li></ul>';

            titleProvChart.innerHTML  = chartDetails;
            document.getElementById('divProvChart').append(titleProvChart);
            document.getElementById('divProvChart').append(divProvChartItem);
            
            var data = [adminDaily];
            Plotly.newPlot(provDiv, data);

        }
    }

        // ======================
    // Functions start

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

    // moving average function - used in chart y axis value
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

    createCanadaChart();

    createProvChart();

    // Functions end
    // ======================

});
