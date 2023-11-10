#!/usr/bin/env node
const fs = require('fs')
const csvParse = require('csv-parser')
const moment = require('moment')
const yargs = require('yargs/yargs')
const { hideBin } = require('yargs/helpers')
const { writeToPath } = require('fast-csv')

const argv = yargs(hideBin(process.argv))
  .option('input', {
    alias: 'i',
    describe: 'Input CSV file path',
    type: 'string',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    describe: 'Output CSV file path',
    type: 'string',
    default: 'meter_output.csv'
  })
  .option('cost', {
    alias: 'c',
    describe: 'Cost multiplier for total cost calculation',
    type: 'number',
    default: 0.6007
  })
  .argv

const inputFile = argv.input
const outputFile = argv.output
const costMultiplier = argv.cost
const processedRows = []
const totals = {}

// Utility functions to determine conditions
const isWeekend = (dayOfWeek) => dayOfWeek === 6 || dayOfWeek === 7
const isNight = (hour) => hour >= 0 && hour < 7
const isDay = (hour) => hour >= 8 && hour < 16
const isEveningOrEarlyMorning = (hour) => hour >= 23 || hour < 7
const isWorkFromHomeHours = (hour) => hour >= 7 && hour < 17
const isElectraHiTechHours = (hour) => hour >= 23 && hour < 17
const isCellcomNight = (dayOfWeek, hour) => (dayOfWeek <= 5 && (hour >= 22 || hour < 7)) || (dayOfWeek === 6 && hour < 7)

const processRow = (row) => {
  const dateTime = moment(row[0], 'DD/MM/YYYY HH:mm', true)
  const kwh = parseFloat(row[1])

  if (!dateTime.isValid() || isNaN(kwh)) {
    return null
  }

  const dayOfWeek = dateTime.isoWeekday()
  const hour = dateTime.hour()

  return {
    DateTime: row[0],
    KWH: kwh,
    Pazgas24: kwh * 0.95,
    PazgasWeekend: isWeekend(dayOfWeek) ? kwh * 0.9 : kwh,
    PazgasNight: !isWeekend(dayOfWeek) && isNight(hour) ? kwh * 0.85 : kwh,
    PazgasDay: !isWeekend(dayOfWeek) && isDay(hour) ? kwh * 0.85 : kwh,
    ElectraPower: kwh * 0.95,
    ElectraHitech: isElectraHiTechHours(hour) ? kwh * 0.92 : kwh,
    ElectraNight: isEveningOrEarlyMorning(hour) ? kwh * 0.8 : kwh,
    Amisragaz24: kwh * 0.935,
    Cellcom24: kwh * 0.95,
    CellcomWorkFromHome: !isWeekend(dayOfWeek) && isWorkFromHomeHours(hour) ? kwh * 0.85 : kwh,
    CellcomNight: isCellcomNight(dayOfWeek, hour) ? kwh * 0.8 : kwh
  }
}

fs.createReadStream(inputFile)
  .pipe(csvParse({ headers: false }))
  .on('data', (row) => {
    const processed = processRow(row);
    if (processed) {
      processedRows.push(processed);
      Object.keys(processed).forEach((key) => {
        if (key !== 'DateTime') { // Exclude DateTime from totals
          totals[key] = (totals[key] || 0) + processed[key];
        }
      });
    }
  })
  .on('end', () => {
    const totalKwhCost = totals['KWH'] * costMultiplier;
    const totalCosts = {};
    const totalDiscounts = {};
    const discountPercentage = {};

    Object.keys(totals).forEach((key) => {
      if (key !== 'DateTime') { // Exclude DateTime from totals
        // Calculate total cost for each key
        totalCosts[key] = totals[key] * costMultiplier;
      }
    });

    Object.keys(totalCosts).forEach((key) => {
      if (key !== 'KWH' && key !== 'DateTime') { // Exclude KWH and DateTime from discounts
        // Calculate total discounts for each key
        totalDiscounts[key] = totalKwhCost - totalCosts[key];
        // Calculate discount percent for each key
        discountPercentage[key] = (totalDiscounts[key] / totalKwhCost) * 100;
      } else {
        totalDiscounts[key] = 0; // No discount for KWH itself
        discountPercentage[key] = 0; // No discount percent for KWH itself
      }
    });

    // Add total rows for kWh, costs, discounts, and discount percentage
    totals['DateTime'] = 'Total KWH';
    totalCosts['DateTime'] = 'Total Costs';
    totalDiscounts['DateTime'] = 'Total Discounts';
    discountPercentage['DateTime'] = 'Discount Percentage';

    processedRows.push(totals);
    processedRows.push(totalCosts);
    processedRows.push(totalDiscounts);
    processedRows.push(discountPercentage);

    // Write processed rows to output file
    writeToPath(outputFile, processedRows, { headers: true })
      .on('finish', () => {
        console.log(`Processing complete. Output saved to ${outputFile}`)

        // Calculate and print summary of top 5 discounted plans
        const discountArray = Object.keys(discountPercentage).map((key) => ({
          plan: key,
          discountPercentage: discountPercentage[key],
        }))

        // Remove 'DateTime' and 'KWH' from the list for sorting
        const discountsExcludingDateTimeAndKWH = discountArray.filter((item) => item.plan !== 'DateTime' && item.plan !== 'KWH')

        // Sort in descending order of discount percentages
        discountsExcludingDateTimeAndKWH.sort((a, b) => b.discountPercentage - a.discountPercentage)

        // Get the top 5 plans
        const top5DiscountedPlans = discountsExcludingDateTimeAndKWH.slice(0, 5)

        console.log('Top 5 Most Discounted Plans:')
        top5DiscountedPlans.forEach((plan, index) => {
          console.log(`${index + 1}. ${plan.plan}: ${plan.discountPercentage.toFixed(2)}%`)
        })
      })
      .on('error', (err) => console.error('Error writing processed data to CSV:', err))
  })
  .on('error', (err) => console.error('Error reading input CSV:', err))
