# Canada COVID-19 Vaccine Distribution and Administration

This code is used to create visualizations illustrating the huge task to meet the Canadian government's goal of providing vaccinations for all age 15+ Canadians by Sep 30, 2021. 

The visualizations include the following data:

* Actual count of vaccine doses administered to-date across Canada as reported by provinces (blue bars).

* Calculated count of dose administration remaining that is required to fully vaccinate age 15+ population by Sep 30, 2021 (gray bars).. 

The total calculated count of projected dose administration for Canada and each province is equal to their respective population's x 2, minus the count of doses administered to-date. 

A daily dose count is then calculated by dividing the total by the number of days between the last actual reporting date and Sep 30, 2021.

Population x 2 is used because dose administration reporting records single doses but two doses are required for full vaccination using the available Pfizer and Moderna vaccines. This would be updated if and when single dose vaccines become available.

## Additional Notes

It should be noted that the Canadian government has specifically said the goal was to provide vaccinations to "all Canadians who wanted them." Given polling demonstrating vaccine hesitancy by some Canadians, the total vaccine doses required to meet the "all Canadians who want the vaccine" goal will be less than the population x 2, but how much is not yet clear. 

In addition, "herd immunity" for COVID-19 is thought to be conferred if at least 70% of the population receives a vaccine.  But some fear that the extremely infectious nature of COVID-19 could require a significantly higher threshold.

Given the uncertainty of both cases above it is better to use vaccination of 100% of age 15+ population as the goal.

## View visualizations here

<a href="https://sitrucp.github.io/covid_canada_vaccinations/index.html" target="_blank">https://sitrucp.github.io/covid_canada_vaccinations/index.html</a>

## Data source

The COVID-91 vaccination data comes from the <a href = "https://github.com/ishaberry/Covid19Canada" target="blank">COVID-19 Canada Open Data Working Group</a> The working group gets this data from provincial COVID-91 reporting. 
