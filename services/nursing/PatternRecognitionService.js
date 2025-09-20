/**
 * Pattern Recognition Service for Outcome Measures
 * Analyzes outcome data patterns to identify trends and anomalies
 */

class PatternRecognitionService {
  constructor() {
    this.patterns = {
      trends: {
        improving: { threshold: 0.1, minDataPoints: 5 },
        declining: { threshold: -0.1, minDataPoints: 5 },
        stable: { varianceThreshold: 0.05 },
      },
      anomalies: {
        outlierThreshold: 2.5, // Standard deviations
        seasonalityWindow: 30, // days
      },
    };
  }

  /**
   * Analyze patterns in outcome measure data
   * @param {string} userId - User identifier
   * @param {Array} outcomeData - Array of outcome measures
   * @param {Object} options - Analysis options
   * @returns {Object} Pattern analysis results
   */
  async analyzePatterns(userId, outcomeData, options = {}) {
    try {
      if (!outcomeData || outcomeData.length === 0) {
        return {
          success: false,
          message: "Insufficient data for pattern analysis",
          patterns: null,
        };
      }

      const analysis = {
        trends: await this.analyzeTrends(outcomeData, options),
        anomalies: await this.detectAnomalies(outcomeData, options),
        correlations: await this.findCorrelations(outcomeData, options),
        seasonality: await this.detectSeasonality(outcomeData, options),
      };

      return {
        success: true,
        userId,
        analysisDate: new Date(),
        dataPoints: outcomeData.length,
        patterns: analysis,
        confidence: this.calculateConfidence(analysis, outcomeData.length),
      };
    } catch (error) {
      console.error("Pattern recognition error:", error);
      return {
        success: false,
        error: error.message,
        patterns: null,
      };
    }
  }

  /**
   * Analyze trends in outcome data
   */
  async analyzeTrends(data, options) {
    const sortedData = data.sort(
      (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
    );
    const trends = {};

    // Group by indicator type
    const groupedData = this.groupByIndicator(sortedData);

    for (const [indicator, values] of Object.entries(groupedData)) {
      if (values.length < this.patterns.trends.improving.minDataPoints) {
        trends[indicator] = {
          status: "insufficient_data",
          dataPoints: values.length,
        };
        continue;
      }

      const trendAnalysis = this.calculateTrend(values);
      trends[indicator] = {
        direction: trendAnalysis.direction,
        slope: trendAnalysis.slope,
        confidence: trendAnalysis.confidence,
        dataPoints: values.length,
        timespan: this.calculateTimespan(values),
      };
    }

    return trends;
  }

  /**
   * Detect anomalies in outcome data
   */
  async detectAnomalies(data, options) {
    const anomalies = [];
    const groupedData = this.groupByIndicator(data);

    for (const [indicator, values] of Object.entries(groupedData)) {
      if (values.length < 10) continue; // Need sufficient data for anomaly detection

      const stats = this.calculateStatistics(values.map((v) => v.value));
      const outliers = values.filter((value) => {
        const zScore = Math.abs((value.value - stats.mean) / stats.stdDev);
        return zScore > this.patterns.anomalies.outlierThreshold;
      });

      outliers.forEach((outlier) => {
        anomalies.push({
          indicator,
          value: outlier.value,
          expectedRange: {
            min: stats.mean - 2 * stats.stdDev,
            max: stats.mean + 2 * stats.stdDev,
          },
          severity: this.calculateAnomalySeverity(outlier.value, stats),
          date: outlier.createdAt,
          patientId: outlier.patientId,
        });
      });
    }

    return {
      count: anomalies.length,
      anomalies: anomalies.sort((a, b) => b.severity - a.severity),
    };
  }

  /**
   * Find correlations between different indicators
   */
  async findCorrelations(data, options) {
    const correlations = {};
    const indicators = [...new Set(data.map((d) => d.indicatorType))];

    for (let i = 0; i < indicators.length; i++) {
      for (let j = i + 1; j < indicators.length; j++) {
        const indicator1 = indicators[i];
        const indicator2 = indicators[j];

        const correlation = this.calculateCorrelation(
          data,
          indicator1,
          indicator2
        );
        if (Math.abs(correlation.coefficient) > 0.3) {
          // Only significant correlations
          correlations[`${indicator1}_${indicator2}`] = correlation;
        }
      }
    }

    return correlations;
  }

  /**
   * Detect seasonal patterns in data
   */
  async detectSeasonality(data, options) {
    const seasonalPatterns = {};
    const groupedData = this.groupByIndicator(data);

    for (const [indicator, values] of Object.entries(groupedData)) {
      if (values.length < 60) continue; // Need at least 2 months of data

      const monthlyAverages = this.calculateMonthlyAverages(values);
      const seasonality = this.detectSeasonalPattern(monthlyAverages);

      if (seasonality.isSignificant) {
        seasonalPatterns[indicator] = seasonality;
      }
    }

    return seasonalPatterns;
  }

  /**
   * Helper methods
   */
  groupByIndicator(data) {
    return data.reduce((groups, item) => {
      const indicator = item.indicatorType;
      if (!groups[indicator]) groups[indicator] = [];
      groups[indicator].push(item);
      return groups;
    }, {});
  }

  calculateTrend(values) {
    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values.map((v) => v.value);

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared for confidence
    const yMean = sumY / n;
    const ssRes = y.reduce(
      (sum, yi, i) => sum + Math.pow(yi - (slope * x[i] + intercept), 2),
      0
    );
    const ssTot = y.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const rSquared = 1 - ssRes / ssTot;

    let direction = "stable";
    if (slope > this.patterns.trends.improving.threshold)
      direction = "improving";
    else if (slope < this.patterns.trends.declining.threshold)
      direction = "declining";

    return {
      direction,
      slope,
      intercept,
      confidence: rSquared,
    };
  }

  calculateStatistics(values) {
    const n = values.length;
    const mean = values.reduce((a, b) => a + b, 0) / n;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
    const stdDev = Math.sqrt(variance);

    return { mean, variance, stdDev, count: n };
  }

  calculateCorrelation(data, indicator1, indicator2) {
    const data1 = data
      .filter((d) => d.indicatorType === indicator1)
      .map((d) => ({ date: d.createdAt, value: d.value }));
    const data2 = data
      .filter((d) => d.indicatorType === indicator2)
      .map((d) => ({ date: d.createdAt, value: d.value }));

    // Find overlapping time periods
    const overlapping = this.findOverlappingPeriods(data1, data2);

    if (overlapping.length < 5) {
      return {
        coefficient: 0,
        significance: "insufficient_data",
        dataPoints: overlapping.length,
      };
    }

    const values1 = overlapping.map((d) => d.value1);
    const values2 = overlapping.map((d) => d.value2);

    const coefficient = this.pearsonCorrelation(values1, values2);

    return {
      coefficient,
      significance:
        Math.abs(coefficient) > 0.7
          ? "strong"
          : Math.abs(coefficient) > 0.3
          ? "moderate"
          : "weak",
      dataPoints: overlapping.length,
    };
  }

  pearsonCorrelation(x, y) {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumYY = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt(
      (n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY)
    );

    return denominator === 0 ? 0 : numerator / denominator;
  }

  calculateMonthlyAverages(values) {
    const monthlyData = {};

    values.forEach((value) => {
      const month = new Date(value.createdAt).getMonth();
      if (!monthlyData[month]) monthlyData[month] = [];
      monthlyData[month].push(value.value);
    });

    const averages = {};
    for (const [month, vals] of Object.entries(monthlyData)) {
      averages[month] = vals.reduce((a, b) => a + b, 0) / vals.length;
    }

    return averages;
  }

  detectSeasonalPattern(monthlyAverages) {
    const months = Object.keys(monthlyAverages)
      .map(Number)
      .sort((a, b) => a - b);
    const values = months.map((month) => monthlyAverages[month]);

    if (values.length < 6) {
      return { isSignificant: false, reason: "insufficient_months" };
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance =
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length;
    const coefficientOfVariation = Math.sqrt(variance) / mean;

    return {
      isSignificant: coefficientOfVariation > 0.1,
      pattern: this.identifySeasonalPattern(monthlyAverages),
      strength: coefficientOfVariation,
      monthlyAverages,
    };
  }

  identifySeasonalPattern(monthlyAverages) {
    const values = Object.values(monthlyAverages);
    const maxValue = Math.max(...values);
    const minValue = Math.min(...values);
    const maxMonth = Object.keys(monthlyAverages).find(
      (month) => monthlyAverages[month] === maxValue
    );
    const minMonth = Object.keys(monthlyAverages).find(
      (month) => monthlyAverages[month] === minValue
    );

    return {
      peak: { month: parseInt(maxMonth), value: maxValue },
      trough: { month: parseInt(minMonth), value: minValue },
      amplitude: maxValue - minValue,
    };
  }

  findOverlappingPeriods(data1, data2, windowDays = 7) {
    const overlapping = [];

    data1.forEach((d1) => {
      const matchingData2 = data2.filter((d2) => {
        const timeDiff = Math.abs(new Date(d1.date) - new Date(d2.date));
        return timeDiff <= windowDays * 24 * 60 * 60 * 1000; // Within window
      });

      if (matchingData2.length > 0) {
        // Use closest match
        const closest = matchingData2.reduce((prev, curr) => {
          const prevDiff = Math.abs(new Date(d1.date) - new Date(prev.date));
          const currDiff = Math.abs(new Date(d1.date) - new Date(curr.date));
          return currDiff < prevDiff ? curr : prev;
        });

        overlapping.push({
          date: d1.date,
          value1: d1.value,
          value2: closest.value,
        });
      }
    });

    return overlapping;
  }

  calculateAnomalySeverity(value, stats) {
    const zScore = Math.abs((value - stats.mean) / stats.stdDev);
    if (zScore > 3) return "high";
    if (zScore > 2.5) return "medium";
    return "low";
  }

  calculateTimespan(values) {
    if (values.length < 2) return 0;

    const dates = values
      .map((v) => new Date(v.createdAt))
      .sort((a, b) => a - b);
    const firstDate = dates[0];
    const lastDate = dates[dates.length - 1];

    return Math.ceil((lastDate - firstDate) / (1000 * 60 * 60 * 24)); // Days
  }

  calculateConfidence(analysis, dataPoints) {
    let confidence = 0.5; // Base confidence

    // Increase confidence based on data points
    if (dataPoints > 100) confidence += 0.3;
    else if (dataPoints > 50) confidence += 0.2;
    else if (dataPoints > 20) confidence += 0.1;

    // Increase confidence based on trend consistency
    const trendCount = Object.keys(analysis.trends).length;
    if (trendCount > 5) confidence += 0.1;

    // Decrease confidence if many anomalies
    if (analysis.anomalies.count > dataPoints * 0.1) confidence -= 0.2;

    return Math.max(0.1, Math.min(0.95, confidence));
  }
}

export default PatternRecognitionService;
