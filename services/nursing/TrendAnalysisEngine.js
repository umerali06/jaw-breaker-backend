/**
 * TrendAnalysisEngine - Advanced trend analysis algorithms for historical outcome data
 * Implements Requirements: 2.3, 3.1, 3.2 - Trend analysis based on historical data
 *
 * This service provides comprehensive trend analysis capabilities including
 * statistical analysis, pattern recognition, and predictive modeling.
 */

export class TrendAnalysisEngine {
  constructor() {
    this.analysisTypes = {
      LINEAR: "linear",
      EXPONENTIAL: "exponential",
      SEASONAL: "seasonal",
      MOVING_AVERAGE: "moving_average",
    };
  }

  /**
   * Analyze trends in outcome measures data
   * @param {Array} dataPoints - Array of data points with timestamp and value
   * @param {Object} options - Analysis options
   * @returns {Promise<Object>} Comprehensive trend analysis results
   */
  async analyzeTrends(dataPoints, options = {}) {
    try {
      const {
        analysisType = this.analysisTypes.LINEAR,
        timeframe = "6months",
        granularity = "weekly",
        includeSeasonality = true,
        confidenceLevel = 0.95,
      } = options;

      // Validate and prepare data
      const preparedData = this.prepareDataForAnalysis(dataPoints, granularity);

      if (preparedData.length < 3) {
        return {
          hasInsufficientData: true,
          message:
            "Insufficient data points for trend analysis (minimum 3 required)",
          dataPointCount: preparedData.length,
        };
      }

      // Perform statistical analysis
      const statistics = this.calculateStatistics(preparedData);

      // Calculate trend direction and strength
      const trendAnalysis = this.calculateTrendAnalysis(
        preparedData,
        analysisType
      );

      // Detect patterns and anomalies
      const patternAnalysis = this.detectPatterns(preparedData);

      // Calculate seasonality if requested
      let seasonalityAnalysis = null;
      if (includeSeasonality && preparedData.length >= 12) {
        seasonalityAnalysis = this.analyzeSeasonality(preparedData);
      }

      // Generate forecasts
      const forecast = this.generateForecast(preparedData, analysisType, 4); // 4 periods ahead

      // Calculate confidence intervals
      const confidenceIntervals = this.calculateConfidenceIntervals(
        preparedData,
        trendAnalysis,
        confidenceLevel
      );

      // Generate insights and recommendations
      const insights = this.generateTrendInsights(
        trendAnalysis,
        patternAnalysis,
        statistics
      );
      const recommendations = this.generateTrendRecommendations(
        trendAnalysis,
        insights
      );

      return {
        hasInsufficientData: false,
        dataPointCount: preparedData.length,
        timeframe,
        granularity,
        statistics,
        trendAnalysis,
        patternAnalysis,
        seasonalityAnalysis,
        forecast,
        confidenceIntervals,
        insights,
        recommendations,
        metadata: {
          analyzedAt: new Date(),
          analysisType,
          confidenceLevel,
        },
      };
    } catch (error) {
      console.error("Error analyzing trends:", error);
      throw new Error(`Trend analysis failed: ${error.message}`);
    }
  }

  /**
   * Prepare data for analysis by aggregating to specified granularity
   * @param {Array} dataPoints - Raw data points
   * @param {string} granularity - Time granularity (daily, weekly, monthly)
   * @returns {Array} Prepared data points
   */
  prepareDataForAnalysis(dataPoints, granularity) {
    // Sort by timestamp
    const sortedData = dataPoints.sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    // Group by time period based on granularity
    const groupedData = this.groupByTimePeriod(sortedData, granularity);

    // Calculate aggregated values for each period
    return Object.entries(groupedData)
      .map(([period, points]) => ({
        period,
        timestamp: new Date(period),
        value: this.calculateAggregatedValue(points),
        count: points.length,
        min: Math.min(...points.map((p) => p.value)),
        max: Math.max(...points.map((p) => p.value)),
        variance: this.calculateVariance(points.map((p) => p.value)),
      }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  /**
   * Group data points by time period
   * @param {Array} dataPoints - Sorted data points
   * @param {string} granularity - Time granularity
   * @returns {Object} Grouped data
   */
  groupByTimePeriod(dataPoints, granularity) {
    const grouped = {};

    dataPoints.forEach((point) => {
      const date = new Date(point.timestamp);
      let periodKey;

      switch (granularity) {
        case "daily":
          periodKey = date.toISOString().split("T")[0];
          break;
        case "weekly":
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = weekStart.toISOString().split("T")[0];
          break;
        case "monthly":
          periodKey = `${date.getFullYear()}-${String(
            date.getMonth() + 1
          ).padStart(2, "0")}`;
          break;
        default:
          periodKey = date.toISOString().split("T")[0];
      }

      if (!grouped[periodKey]) {
        grouped[periodKey] = [];
      }
      grouped[periodKey].push(point);
    });

    return grouped;
  }

  /**
   * Calculate aggregated value for a group of points
   * @param {Array} points - Data points in the group
   * @returns {number} Aggregated value
   */
  calculateAggregatedValue(points) {
    // Use weighted average based on confidence if available
    const totalWeight = points.reduce((sum, p) => sum + (p.confidence || 1), 0);
    const weightedSum = points.reduce(
      (sum, p) => sum + p.value * (p.confidence || 1),
      0
    );
    return weightedSum / totalWeight;
  }

  /**
   * Calculate basic statistics for the dataset
   * @param {Array} dataPoints - Prepared data points
   * @returns {Object} Statistical measures
   */
  calculateStatistics(dataPoints) {
    const values = dataPoints.map((p) => p.value);
    const n = values.length;

    const mean = values.reduce((sum, val) => sum + val, 0) / n;
    const variance = this.calculateVariance(values);
    const standardDeviation = Math.sqrt(variance);

    const sortedValues = [...values].sort((a, b) => a - b);
    const median =
      n % 2 === 0
        ? (sortedValues[n / 2 - 1] + sortedValues[n / 2]) / 2
        : sortedValues[Math.floor(n / 2)];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min;

    // Calculate coefficient of variation
    const coefficientOfVariation =
      mean !== 0 ? (standardDeviation / Math.abs(mean)) * 100 : 0;

    return {
      count: n,
      mean,
      median,
      min,
      max,
      range,
      variance,
      standardDeviation,
      coefficientOfVariation,
      firstValue: values[0],
      lastValue: values[n - 1],
      totalChange: values[n - 1] - values[0],
      percentageChange:
        values[0] !== 0
          ? ((values[n - 1] - values[0]) / Math.abs(values[0])) * 100
          : 0,
    };
  }

  /**
   * Calculate variance for an array of values
   * @param {Array} values - Array of numeric values
   * @returns {number} Variance
   */
  calculateVariance(values) {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    return (
      values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
      values.length
    );
  }

  /**
   * Calculate trend analysis using specified method
   * @param {Array} dataPoints - Prepared data points
   * @param {string} analysisType - Type of trend analysis
   * @returns {Object} Trend analysis results
   */
  calculateTrendAnalysis(dataPoints, analysisType) {
    switch (analysisType) {
      case this.analysisTypes.LINEAR:
        return this.calculateLinearTrend(dataPoints);
      case this.analysisTypes.EXPONENTIAL:
        return this.calculateExponentialTrend(dataPoints);
      case this.analysisTypes.MOVING_AVERAGE:
        return this.calculateMovingAverageTrend(dataPoints);
      default:
        return this.calculateLinearTrend(dataPoints);
    }
  }

  /**
   * Calculate linear trend using least squares regression
   * @param {Array} dataPoints - Data points
   * @returns {Object} Linear trend analysis
   */
  calculateLinearTrend(dataPoints) {
    const n = dataPoints.length;
    const x = dataPoints.map((_, i) => i); // Time index
    const y = dataPoints.map((p) => p.value);

    // Calculate linear regression coefficients
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    // Calculate R-squared (coefficient of determination)
    const yMean = sumY / n;
    const totalSumSquares = y.reduce(
      (sum, val) => sum + Math.pow(val - yMean, 2),
      0
    );
    const residualSumSquares = y.reduce((sum, val, i) => {
      const predicted = slope * x[i] + intercept;
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    const rSquared = 1 - residualSumSquares / totalSumSquares;

    // Determine trend direction and strength
    const trendDirection =
      slope > 0.01 ? "increasing" : slope < -0.01 ? "decreasing" : "stable";
    const trendStrength = this.categorizeTrendStrength(
      Math.abs(slope),
      rSquared
    );

    return {
      type: "linear",
      slope,
      intercept,
      rSquared,
      trendDirection,
      trendStrength,
      equation: `y = ${slope.toFixed(4)}x + ${intercept.toFixed(4)}`,
      significance: this.calculateTrendSignificance(slope, rSquared, n),
    };
  }

  /**
   * Calculate exponential trend
   * @param {Array} dataPoints - Data points
   * @returns {Object} Exponential trend analysis
   */
  calculateExponentialTrend(dataPoints) {
    // Transform to logarithmic scale for exponential fitting
    const validPoints = dataPoints.filter((p) => p.value > 0);
    if (validPoints.length < 3) {
      return {
        type: "exponential",
        error: "Insufficient positive values for exponential analysis",
      };
    }

    const x = validPoints.map((_, i) => i);
    const lnY = validPoints.map((p) => Math.log(p.value));

    // Perform linear regression on log-transformed data
    const n = validPoints.length;
    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumLnY = lnY.reduce((sum, val) => sum + val, 0);
    const sumXLnY = x.reduce((sum, val, i) => sum + val * lnY[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);

    const b = (n * sumXLnY - sumX * sumLnY) / (n * sumXX - sumX * sumX);
    const lnA = (sumLnY - b * sumX) / n;
    const a = Math.exp(lnA);

    // Calculate R-squared for exponential fit
    const lnYMean = sumLnY / n;
    const totalSumSquares = lnY.reduce(
      (sum, val) => sum + Math.pow(val - lnYMean, 2),
      0
    );
    const residualSumSquares = lnY.reduce((sum, val, i) => {
      const predicted = b * x[i] + lnA;
      return sum + Math.pow(val - predicted, 2);
    }, 0);
    const rSquared = 1 - residualSumSquares / totalSumSquares;

    const growthRate = (Math.exp(b) - 1) * 100; // Convert to percentage
    const trendDirection =
      b > 0.01
        ? "exponential_growth"
        : b < -0.01
        ? "exponential_decay"
        : "stable";

    return {
      type: "exponential",
      a,
      b,
      growthRate,
      rSquared,
      trendDirection,
      equation: `y = ${a.toFixed(4)} * e^(${b.toFixed(4)}x)`,
      significance: this.calculateTrendSignificance(b, rSquared, n),
    };
  }

  /**
   * Calculate moving average trend
   * @param {Array} dataPoints - Data points
   * @param {number} window - Moving average window size
   * @returns {Object} Moving average trend analysis
   */
  calculateMovingAverageTrend(dataPoints, window = 3) {
    if (dataPoints.length < window) {
      return {
        type: "moving_average",
        error: "Insufficient data for moving average",
      };
    }

    const movingAverages = [];
    for (let i = window - 1; i < dataPoints.length; i++) {
      const windowData = dataPoints.slice(i - window + 1, i + 1);
      const average = windowData.reduce((sum, p) => sum + p.value, 0) / window;
      movingAverages.push({
        period: dataPoints[i].period,
        value: average,
        originalValue: dataPoints[i].value,
      });
    }

    // Calculate trend of moving averages
    const maTrend = this.calculateLinearTrend(
      movingAverages.map((ma, i) => ({
        value: ma.value,
        timestamp: new Date(),
      }))
    );

    return {
      type: "moving_average",
      window,
      movingAverages,
      trend: maTrend,
      smoothingEffect: this.calculateSmoothingEffect(
        dataPoints,
        movingAverages
      ),
    };
  }

  /**
   * Categorize trend strength based on slope and R-squared
   * @param {number} slope - Absolute slope value
   * @param {number} rSquared - R-squared value
   * @returns {string} Trend strength category
   */
  categorizeTrendStrength(slope, rSquared) {
    if (rSquared < 0.3) return "weak";
    if (rSquared < 0.7) return "moderate";
    return "strong";
  }

  /**
   * Calculate trend significance
   * @param {number} slope - Trend slope
   * @param {number} rSquared - R-squared value
   * @param {number} n - Sample size
   * @returns {Object} Significance measures
   */
  calculateTrendSignificance(slope, rSquared, n) {
    // Simplified significance calculation
    const isSignificant = rSquared > 0.5 && n > 5;
    const confidenceLevel =
      rSquared > 0.8 ? "high" : rSquared > 0.5 ? "medium" : "low";

    return {
      isSignificant,
      confidenceLevel,
      rSquared,
      sampleSize: n,
    };
  }

  /**
   * Detect patterns and anomalies in the data
   * @param {Array} dataPoints - Data points
   * @returns {Object} Pattern analysis results
   */
  detectPatterns(dataPoints) {
    const patterns = {
      outliers: this.detectOutliers(dataPoints),
      cycles: this.detectCycles(dataPoints),
      changePoints: this.detectChangePoints(dataPoints),
      volatility: this.calculateVolatility(dataPoints),
    };

    return patterns;
  }

  /**
   * Detect outliers using IQR method
   * @param {Array} dataPoints - Data points
   * @returns {Array} Outlier information
   */
  detectOutliers(dataPoints) {
    const values = dataPoints.map((p) => p.value);
    const sortedValues = [...values].sort((a, b) => a - b);
    const n = sortedValues.length;

    const q1 = sortedValues[Math.floor(n * 0.25)];
    const q3 = sortedValues[Math.floor(n * 0.75)];
    const iqr = q3 - q1;
    const lowerBound = q1 - 1.5 * iqr;
    const upperBound = q3 + 1.5 * iqr;

    return dataPoints
      .map((point, index) => ({
        ...point,
        index,
        isOutlier: point.value < lowerBound || point.value > upperBound,
        outlierType:
          point.value < lowerBound
            ? "low"
            : point.value > upperBound
            ? "high"
            : null,
      }))
      .filter((point) => point.isOutlier);
  }

  /**
   * Detect cyclical patterns
   * @param {Array} dataPoints - Data points
   * @returns {Object} Cycle detection results
   */
  detectCycles(dataPoints) {
    if (dataPoints.length < 6) {
      return {
        detected: false,
        reason: "Insufficient data for cycle detection",
      };
    }

    // Simple peak and trough detection
    const peaks = [];
    const troughs = [];

    for (let i = 1; i < dataPoints.length - 1; i++) {
      const prev = dataPoints[i - 1].value;
      const curr = dataPoints[i].value;
      const next = dataPoints[i + 1].value;

      if (curr > prev && curr > next) {
        peaks.push({ index: i, value: curr, period: dataPoints[i].period });
      } else if (curr < prev && curr < next) {
        troughs.push({ index: i, value: curr, period: dataPoints[i].period });
      }
    }

    const hasCycles = peaks.length >= 2 && troughs.length >= 2;

    return {
      detected: hasCycles,
      peaks,
      troughs,
      cycleCount: Math.min(peaks.length, troughs.length),
      averageCycleLength: hasCycles
        ? this.calculateAverageCycleLength(peaks, troughs)
        : null,
    };
  }

  /**
   * Calculate average cycle length
   * @param {Array} peaks - Peak points
   * @param {Array} troughs - Trough points
   * @returns {number} Average cycle length
   */
  calculateAverageCycleLength(peaks, troughs) {
    if (peaks.length < 2) return null;

    const peakIntervals = [];
    for (let i = 1; i < peaks.length; i++) {
      peakIntervals.push(peaks[i].index - peaks[i - 1].index);
    }

    return (
      peakIntervals.reduce((sum, interval) => sum + interval, 0) /
      peakIntervals.length
    );
  }

  /**
   * Detect change points in the trend
   * @param {Array} dataPoints - Data points
   * @returns {Array} Change points
   */
  detectChangePoints(dataPoints) {
    const changePoints = [];
    const windowSize = Math.max(3, Math.floor(dataPoints.length / 4));

    for (let i = windowSize; i < dataPoints.length - windowSize; i++) {
      const beforeWindow = dataPoints.slice(i - windowSize, i);
      const afterWindow = dataPoints.slice(i, i + windowSize);

      const beforeMean =
        beforeWindow.reduce((sum, p) => sum + p.value, 0) / beforeWindow.length;
      const afterMean =
        afterWindow.reduce((sum, p) => sum + p.value, 0) / afterWindow.length;

      const changeRatio = Math.abs(afterMean - beforeMean) / beforeMean;

      if (changeRatio > 0.2) {
        // 20% change threshold
        changePoints.push({
          index: i,
          period: dataPoints[i].period,
          beforeMean,
          afterMean,
          changeRatio,
          changeType: afterMean > beforeMean ? "increase" : "decrease",
        });
      }
    }

    return changePoints;
  }

  /**
   * Calculate volatility measures
   * @param {Array} dataPoints - Data points
   * @returns {Object} Volatility analysis
   */
  calculateVolatility(dataPoints) {
    if (dataPoints.length < 2) {
      return { volatility: 0, classification: "insufficient_data" };
    }

    // Calculate period-to-period changes
    const changes = [];
    for (let i = 1; i < dataPoints.length; i++) {
      const change =
        (dataPoints[i].value - dataPoints[i - 1].value) /
        dataPoints[i - 1].value;
      changes.push(change);
    }

    const volatility = Math.sqrt(this.calculateVariance(changes));

    let classification;
    if (volatility < 0.05) classification = "low";
    else if (volatility < 0.15) classification = "moderate";
    else classification = "high";

    return {
      volatility,
      classification,
      maxChange: Math.max(...changes.map(Math.abs)),
      averageChange:
        changes.reduce((sum, change) => sum + Math.abs(change), 0) /
        changes.length,
    };
  }

  /**
   * Generate forecast based on trend analysis
   * @param {Array} dataPoints - Historical data points
   * @param {string} analysisType - Type of analysis used
   * @param {number} periods - Number of periods to forecast
   * @returns {Array} Forecast data points
   */
  generateForecast(dataPoints, analysisType, periods) {
    const trendAnalysis = this.calculateTrendAnalysis(dataPoints, analysisType);
    const forecast = [];

    const lastIndex = dataPoints.length - 1;
    const lastTimestamp = new Date(dataPoints[lastIndex].timestamp);

    for (let i = 1; i <= periods; i++) {
      const futureIndex = lastIndex + i;
      let predictedValue;

      switch (analysisType) {
        case this.analysisTypes.LINEAR:
          predictedValue =
            trendAnalysis.slope * futureIndex + trendAnalysis.intercept;
          break;
        case this.analysisTypes.EXPONENTIAL:
          predictedValue =
            trendAnalysis.a * Math.exp(trendAnalysis.b * futureIndex);
          break;
        default:
          predictedValue =
            trendAnalysis.slope * futureIndex + trendAnalysis.intercept;
      }

      // Calculate future timestamp (assuming same interval as last two points)
      const interval =
        dataPoints.length > 1
          ? new Date(dataPoints[lastIndex].timestamp) -
            new Date(dataPoints[lastIndex - 1].timestamp)
          : 7 * 24 * 60 * 60 * 1000; // Default to 1 week

      const futureTimestamp = new Date(lastTimestamp.getTime() + i * interval);

      forecast.push({
        period: i,
        timestamp: futureTimestamp,
        predictedValue: Math.max(0, predictedValue), // Ensure non-negative
        confidence: Math.max(0.1, 0.9 - i * 0.1), // Decreasing confidence
      });
    }

    return forecast;
  }

  /**
   * Calculate confidence intervals for predictions
   * @param {Array} dataPoints - Historical data
   * @param {Object} trendAnalysis - Trend analysis results
   * @param {number} confidenceLevel - Confidence level (0-1)
   * @returns {Object} Confidence interval data
   */
  calculateConfidenceIntervals(dataPoints, trendAnalysis, confidenceLevel) {
    const residuals = this.calculateResiduals(dataPoints, trendAnalysis);
    const standardError = Math.sqrt(this.calculateVariance(residuals));

    // Simplified confidence interval calculation
    const zScore =
      confidenceLevel === 0.95 ? 1.96 : confidenceLevel === 0.99 ? 2.58 : 1.64;
    const marginOfError = zScore * standardError;

    return {
      confidenceLevel,
      standardError,
      marginOfError,
      lowerBound: (value) => value - marginOfError,
      upperBound: (value) => value + marginOfError,
    };
  }

  /**
   * Calculate residuals for trend analysis
   * @param {Array} dataPoints - Data points
   * @param {Object} trendAnalysis - Trend analysis results
   * @returns {Array} Residuals
   */
  calculateResiduals(dataPoints, trendAnalysis) {
    return dataPoints.map((point, index) => {
      let predicted;
      switch (trendAnalysis.type) {
        case "linear":
          predicted = trendAnalysis.slope * index + trendAnalysis.intercept;
          break;
        case "exponential":
          predicted = trendAnalysis.a * Math.exp(trendAnalysis.b * index);
          break;
        default:
          predicted = point.value;
      }
      return point.value - predicted;
    });
  }

  /**
   * Generate insights from trend analysis
   * @param {Object} trendAnalysis - Trend analysis results
   * @param {Object} patternAnalysis - Pattern analysis results
   * @param {Object} statistics - Statistical measures
   * @returns {Array} Generated insights
   */
  generateTrendInsights(trendAnalysis, patternAnalysis, statistics) {
    const insights = [];

    // Trend direction insights
    if (trendAnalysis.trendDirection === "increasing") {
      insights.push({
        type: "trend",
        message: `Performance shows an ${trendAnalysis.trendStrength} upward trend`,
        impact: "positive",
        confidence: trendAnalysis.significance?.confidenceLevel || "medium",
      });
    } else if (trendAnalysis.trendDirection === "decreasing") {
      insights.push({
        type: "trend",
        message: `Performance shows a ${trendAnalysis.trendStrength} downward trend`,
        impact: "negative",
        confidence: trendAnalysis.significance?.confidenceLevel || "medium",
      });
    }

    // Volatility insights
    if (patternAnalysis.volatility.classification === "high") {
      insights.push({
        type: "volatility",
        message: "High volatility detected - performance is inconsistent",
        impact: "neutral",
        confidence: "high",
      });
    }

    // Outlier insights
    if (patternAnalysis.outliers.length > 0) {
      insights.push({
        type: "outliers",
        message: `${patternAnalysis.outliers.length} outlier(s) detected`,
        impact: "neutral",
        confidence: "high",
      });
    }

    // Change point insights
    if (patternAnalysis.changePoints.length > 0) {
      const lastChangePoint =
        patternAnalysis.changePoints[patternAnalysis.changePoints.length - 1];
      insights.push({
        type: "change_point",
        message: `Significant ${lastChangePoint.changeType} detected recently`,
        impact:
          lastChangePoint.changeType === "increase" ? "positive" : "negative",
        confidence: "medium",
      });
    }

    return insights;
  }

  /**
   * Generate recommendations based on trend analysis
   * @param {Object} trendAnalysis - Trend analysis results
   * @param {Array} insights - Generated insights
   * @returns {Array} Recommendations
   */
  generateTrendRecommendations(trendAnalysis, insights) {
    const recommendations = [];

    // Trend-based recommendations
    if (trendAnalysis.trendDirection === "decreasing") {
      recommendations.push({
        priority: "high",
        category: "improvement",
        action: "Investigate causes of declining performance",
        rationale: "Downward trend requires immediate attention",
      });
    } else if (trendAnalysis.trendDirection === "increasing") {
      recommendations.push({
        priority: "medium",
        category: "maintenance",
        action: "Continue current practices to maintain positive trend",
        rationale: "Upward trend indicates effective interventions",
      });
    }

    // Volatility-based recommendations
    const volatilityInsight = insights.find((i) => i.type === "volatility");
    if (volatilityInsight) {
      recommendations.push({
        priority: "medium",
        category: "consistency",
        action: "Implement process standardization to reduce variability",
        rationale: "High volatility suggests inconsistent processes",
      });
    }

    // Outlier-based recommendations
    const outlierInsight = insights.find((i) => i.type === "outliers");
    if (outlierInsight) {
      recommendations.push({
        priority: "medium",
        category: "investigation",
        action: "Investigate outlier events for learning opportunities",
        rationale: "Outliers may reveal best practices or issues to address",
      });
    }

    return recommendations;
  }

  /**
   * Calculate smoothing effect of moving average
   * @param {Array} originalData - Original data points
   * @param {Array} smoothedData - Moving average data
   * @returns {Object} Smoothing effect metrics
   */
  calculateSmoothingEffect(originalData, smoothedData) {
    const originalVolatility = this.calculateVolatility(originalData);
    const smoothedVolatility = this.calculateVolatility(smoothedData);

    return {
      originalVolatility: originalVolatility.volatility,
      smoothedVolatility: smoothedVolatility.volatility,
      reductionRatio:
        originalVolatility.volatility > 0
          ? (originalVolatility.volatility - smoothedVolatility.volatility) /
            originalVolatility.volatility
          : 0,
    };
  }
}

export default TrendAnalysisEngine;
