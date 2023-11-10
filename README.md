# ⚡ Electricity Plan Analyzer

## Overview

The Electricity Plan Analyzer is a command-line utility that aids consumers in Israel in making informed decisions about their electricity plan. Users can analyze their electricity consumption data from the Israel Electric Company (IEC) to determine which electricity plan offers the best value based on their usage patterns.

Israeli customers can <a href="https://www.iec.co.il/remote-reading-info" target="_blank">download their consumption data here,</a> which includes KwH usage for every 15-minute interval, and use this tool to compare different plans.

The CLI outputs:

- Discounted KwH for each timeslot
- Total annual KwH consumption
- Total annual cost
- Total annual discount
- Discount percentage for each plan
- Top 5 recommended plans based on the total annual discount

## Plans

Currently, 11 plans from 4 vendors are analyzed:

- <a href="https://campaigns.pazgas.co.il/ele/" target="_blank">Pazgas</a>
    - 24/7 (5%)
    - Weekend (10%)
    - Night (15%)
    - Day (15%)
- <a href="https://electra-power.co.il/" target="_blank">Electra Power</a>
    - Power (5-7%)
    - Hitech (8-10%)
    - Night (20%)
- <a href="https://lp.amisragas.co.il/electric/" target="_blank">Amisragas</a>
    - 24/7 (6.5%)
- <a href="https://cellcom.co.il/production/Private/1/energy3/">Cellcom Energy</a>
    - 24/7 (5-7%)
    - Work from home (15%)
    - Night (20%)

## Usage

To run the Electricity Plan Analyzer, execute the following command with the path to your electricity consumption CSV file:

```
npx electricity-plan-analyzer --input <path-to-csv> --output <output-csv> --cost <cost-multiplier>
```

### Options

- `--input`, `-i`: Path to your electricity usage CSV file. Required.
- `--output`, `-o`: Path for the output CSV file. Defaults to `meter_output.csv`.
- `--cost`, `-c`: The cost multiplier used for calculating the total cost. Defaults to `0.6007`.

### Examples

- Using the default output and cost:

```
npx electricity-plan-analyzer --input /path/to/your/usage.csv
```

- Specifying both input and output files:

```
npx electricity-plan-analyzer --input /path/to/your/usage.csv --output /path/to/your/result.csv
```

- Specifying both input file and custom cost multiplier:

```
npx electricity-plan-analyzer --input /path/to/your/usage.csv --cost 0.65
```

## Acknowledgments

I would like to thank everyone who contributed to the ideation of this tool, especially those who provided valuable feedback and suggestions to improve its functionality.

Code, readme and license were written using GPT4-turbo.

## License

This project is free to use for non-commercial purposes. Commercial use is not permitted.