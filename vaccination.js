
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

    // ggt case and mortality totals by summing values
    var distTotalCanada = dist_canada.reduce((a, b) => +a + +b.dvaccine, 0);
    var adminTotalCanada = admin_canada.reduce((a, b) => +a + +b.avaccine, 0);

    // get canada dist & admin max dates
    maxDistDate = d3.max(dist_canada.map(d=>d.report_date));
    maxAdminDate = d3.max(admin_canada.map(d=>d.report_date));

    //==== population data start ====
    // filter population by age_group
    var sel_age_group = 14;
    var populationFiltered = population.filter(function(d) { 
        return parseInt(d.age_group) > parseInt(sel_age_group);
    });
    
    // summarize population by Canada
    var popByCanada = populationFiltered.reduce((a, b) => +a + +b.population, 0);

    // summarize population by province
    var popByProv = d3.nest()
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
        d.population = popByCanada
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
    const distAdminProvPop = distAdminProv.map(t1 => ({...t1, ...popByProv.find(t2 => t2.province === t1.province)}))

    // add percentages to distAdminProvPop
    distAdminProvPop.forEach(function(d) {
        d.pct_pop_dist = parseInt(d.cumulative_dvaccine) / parseInt(d.population)
        d.pct_pop_admin = parseInt(d.cumulative_avaccine) / parseInt(d.population)
        d.pct_dist_admin = parseInt(d.cumulative_avaccine) / parseInt(d.cumulative_dvaccine)
    });

    // create charts
    // call createCharts when page loads, or when user changes age filter

    function createCanadaChart() {

        // CREATE CANADA CHART

        // create x and y axis data sets
        var x = [];
        var yDistAdmin = [];
        var yPopAdmin = [];
        var yPopDist = [];

        // create axes x and y arrays
        for (var i=0; i<distAdminCanadaPop.length; i++) {
            var row = distAdminCanadaPop[i];
            x.push(row['report_date']);
            yDistAdmin.push(row['pct_dist_admin']);
            yPopAdmin.push(row['pct_pop_admin']);
            yPopDist.push(row['pct_pop_dist']);
        }

        var pctDistAdmin = {
            name: 'pctDistAdmin',
            x: x,
            y: yDistAdmin,
            type: 'scatter',
        };
        
        var pctPopAdmin = {
            name: 'pctPopAdmin',
            x: x,
            y: yPopAdmin,
            type: 'scatter'
        };

        var pctDistAdmin = {
            name: 'pctPopDist',
            x: x,
            y: yPopDist,
            type: 'scatter'
        };
        
        var data = [pctDistAdmin, pctPopAdmin];
        
        Plotly.newPlot('divCanadaChart', data);

    }

    function createProvChart() {
        // CREATE PROV CHART

        // get list of provinces 
        provArray = [];
        for (var i=0; i<distAdminProvPop.length; i++) {
            provArray.push(distAdminProvPop[i]['province']);
        }
        let provList = [...new Set(provArray)];

        // loop through provList to create chart for each prov
        for (var i=0; i<provList.length; i++) {
            
            console.log(provList[i], i);

            var provData = distAdminProvPop.filter(function(d) { 
                return d.province === provList[i];
            });

            // create x and y axis data sets
            var x = [];
            var yDistAdmin = [];
            var yPopAdmin = [];
            var yPopDist = [];

            for (var j=0; j<provData.length; j++) {
                var row = provData[j];
                x.push(row['report_date']);
                yDistAdmin.push(row['pct_dist_admin']);
                yPopAdmin.push(row['pct_pop_admin']);
                yPopDist.push(row['pct_pop_dist']);
            }

            // create Prov chart
            var pctDistAdmin = {
                name: 'pctDistAdmin',
                x: x,
                y: yDistAdmin,
                type: 'scatter',
            };
            
            var pctPopAdmin = {
                name: 'pctPopAdmin',
                x: x,
                y: yPopAdmin,
                type: 'scatter'
            };
            
            var pctDistAdmin = {
                name: 'pctPopDist',
                x: x,
                y: yPopDist,
                type: 'scatter'
            };
            
            //var data = [pctDistAdmin, pctPopAdmin, pctPopDist];
            var data = [pctPopAdmin, pctDistAdmin];

            var provDiv = 'provDiv' + i;
            var provTitle = 'title' + provDiv;
            var titleProvChart = document.createElement("p");
            var divProvChartItem = document.createElement("div");
            
            divProvChartItem.id = provDiv;
            titleProvChart.id = provTitle;
            titleProvChart.textContent = provList[i];

            document.getElementById('divProvChart').append(titleProvChart);
            document.getElementById('divProvChart').append(divProvChartItem);
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
