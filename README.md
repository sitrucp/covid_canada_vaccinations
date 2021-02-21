# Canada COVID-19 Vaccine Distribution and Administration

This code is used to create visualizations that provide insight into the scheduling and effort remaining to meet the Canadian government's goal of providing vaccinations for a target population, defined as age 18+ Canadians, by Sep 30, 2021.

Two types of visualization are created:

*Actual Dose Delivery vs Forecast Dose Delivery*

This visualization tries to create a realistic forecast schedule of vaccine dose deliveries based on available information. It compares actual vs forecast vaccine dose deliveries for Canada. The cumulative amounts track progress towards the complete delivery of 84 million doses.

Pfizer delivers doses weekly and Moderna every three weeks. For purpose of this visualization, these weekly deliveries were split into daily dose delivery amounts. In practice doses will be delivered across Canada in varying amounts and days so daily deliveries will not likely be equal or within delivery weeks.

*Doses Administered vs Remaining Doses To Be Administered* 

These visualizations try show effort remaining to achieve full vaccination. There is one visualization for Canada and one for each province, comparing actual doses administered vs a calculated count of remaining dose administrations to meet goal of vaccinating 18+ population by Sep 30 (about 30.7 million people requiring 61.5 million doses for full vaccination).

Population x 2 is used because dose administration reporting records single doses but two doses are required for full vaccination using the available Pfizer and Moderna vaccines. This would be updated if and when single dose vaccines become available.

% of Target Population Doses Administered is defined as: ((Doses Administered To-Date / (Age 18+ Popluation x 2)) x 100. This is probably the best metric to gauge overall performance of vaccination program as each person requires 2 doses.

It should be noted that the Canadian government has specifically said the goal was to provide vaccinations to "all Canadians who wanted them." Given polling demonstrating vaccine hesitancy by some Canadians, the total vaccine doses required to meet the "all Canadians who want the vaccine" goal will be less than the population x 2, but how much is not yet clear. 

In addition, "herd immunity" for COVID-19 is thought to be conferred if at least 70% of the population receives a vaccine.  But some fear that the extremely infectious nature of COVID-19 could require a significantly higher threshold.

Given the uncertainty of both cases above it is better to use vaccination of 100% of age 18+ population as the goal.

## View visualizations here

<a href="https://sitrucp.github.io/covid_canada_vaccinations/index.html" target="_blank">https://sitrucp.github.io/covid_canada_vaccinations/index.html</a>

## Data source

The COVID-91 vaccination data comes from the <a href = "https://github.com/ishaberry/Covid19Canada" target="blank">COVID-19 Canada Open Data Working Group</a> The working group gets this data from provincial COVID-91 reporting. 
