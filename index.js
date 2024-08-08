#!/usr/bin/env node
const fs = require("fs");
const csvParse = require("csv-parser");
const moment = require("moment");
const yargs = require("yargs/yargs");
const { hideBin } = require("yargs/helpers");
const { writeToPath } = require("fast-csv");

const argv = yargs(hideBin(process.argv))
  .option("input", {
    alias: "i",
    describe: "Input CSV file path",
    type: "string",
    demandOption: true,
  })
  .option("output", {
    alias: "o",
    describe: "Output CSV file path",
    type: "string",
    default: "meter_output.csv",
  })
  .option("cost", {
    alias: "c",
    describe: "Cost multiplier for total cost calculation",
    type: "number",
    default: 0.6007,
  }).argv;

const inputFile = argv.input;
const outputFile = argv.output;
const costMultiplier = argv.cost;
const processedRows = [];
const totals = {};

const processRow = (row) => {
  const dateTime = moment(`${row[0]} ${row[1]}`, "DD/MM/YYYY HH:mm", true);
  const kwh = parseFloat(row[2]);

  if (!dateTime.isValid() || isNaN(kwh)) {
    return null;
  }

  const dayOfWeek = dateTime.isoWeekday();
  const hour = dateTime.hour();
  const month = dateTime.month() + 1;

  return {
    DateTime: row[0],
    KWH: kwh,
    Pazgas24: kwh * 0.93,
    ElectraPower: kwh * 0.95,
    ElectraHitech: hour >= 23 || hour < 17 ? kwh * 0.92 : kwh,
    ElectraNight: hour >= 23 || hour < 7 ? kwh * 0.8 : kwh,
    Amisragaz24: kwh * 0.93,
    Cellcom24: kwh * 0.95,
    CellcomDay: dayOfWeek <= 5 && hour >= 7 && hour < 17 ? kwh * 0.85 : kwh,
    CellcomFamily: hour >= 14 && hour < 20 ? kwh * 0.82 : kwh,
    CellcomNight: hour >= 23 || hour < 7 ? kwh * 0.8 : kwh,
    Bezeq24: kwh * 0.93,
    BezeqDay: dayOfWeek <= 5 && hour >= 7 && hour < 17 ? kwh * 0.85 : kwh,
    BezeqNight: dayOfWeek <= 5 && (hour >= 23 || hour < 7) ? kwh * 0.8 : kwh,
    Taoz:
      ((month >= 6 && month <= 9
        ? dayOfWeek === 6 ||
          dayOfWeek === 7 ||
          (hour >= 0 && hour < 17) ||
          hour === 23
          ? 0.4815
          : 1.6533
        : month === 12 || month <= 2
        ? hour >= 17 && hour < 22
          ? 1.1478
          : 0.4184
        : dayOfWeek <= 5 && hour >= 17 && hour < 22
        ? 0.4583
        : 0.4084) /
        costMultiplier) *
      kwh,
  };
};

fs.createReadStream(inputFile)
  .pipe(csvParse({ headers: false }))
  .on("data", (row) => {
    const processed = processRow(row);
    if (processed) {
      processedRows.push(processed);
      Object.keys(processed).forEach((key) => {
        if (key !== "DateTime") {
          // Exclude DateTime from totals
          totals[key] = (totals[key] || 0) + processed[key];
        }
      });
    }
  })
  .on("end", () => {
    const totalKwhCost = totals["KWH"] * costMultiplier;
    const totalCosts = {};
    const totalDiscounts = {};
    const discountPercentage = {};

    Object.keys(totals).forEach((key) => {
      if (key !== "DateTime") {
        // Exclude DateTime from totals
        // Calculate total cost for each key
        totalCosts[key] = totals[key] * costMultiplier;
      }
    });

    Object.keys(totalCosts).forEach((key) => {
      if (key !== "KWH" && key !== "DateTime") {
        // Exclude KWH and DateTime from discounts
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
    totals["DateTime"] = "Total KWH";
    totalCosts["DateTime"] = "Total Costs";
    totalDiscounts["DateTime"] = "Total Discounts";
    discountPercentage["DateTime"] = "Discount Percentage";

    processedRows.push(totals);
    processedRows.push(totalCosts);
    processedRows.push(totalDiscounts);
    processedRows.push(discountPercentage);

    // Write processed rows to output file
    writeToPath(outputFile, processedRows, { headers: true })
      .on("finish", () => {
        console.log(`Processing complete. Output saved to ${outputFile}`);

        // Calculate and print summary of all discounted plans
        const discountArray = Object.keys(discountPercentage).map((key) => ({
          plan: key,
          discountPercentage: discountPercentage[key],
        }));

        // Remove 'DateTime' and 'KWH' from the list for sorting
        const discountsExcludingDateTimeAndKWH = discountArray.filter(
          (item) => item.plan !== "DateTime" && item.plan !== "KWH"
        );

        // Sort in descending order of discount percentages
        discountsExcludingDateTimeAndKWH.sort(
          (a, b) => b.discountPercentage - a.discountPercentage
        );

        console.log("All plans, sorted by discount:");
        discountsExcludingDateTimeAndKWH.forEach((plan, index) => {
          console.log(
            `${index + 1}. ${plan.plan}: ${plan.discountPercentage.toFixed(2)}%`
          );
        });
      })
      .on("error", (err) =>
        console.error("Error writing processed data to CSV:", err)
      );
  })
  .on("error", (err) => console.error("Error reading input CSV:", err));
