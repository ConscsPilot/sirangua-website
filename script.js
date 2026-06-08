const DATA_URL = "garden-preview-30days.json";
const SVG_NS = "http://www.w3.org/2000/svg";

const dashboardElements = {
    temperature: document.getElementById("temperature-value"),
    humidity: document.getElementById("humidity-value"),
    soilMoisture: document.getElementById("soil-moisture-value"),
    plantStatus: document.getElementById("plant-status-value"),
    updated: document.getElementById("dashboard-updated"),
    trendRange: document.getElementById("trend-range"),
    trendStart: document.getElementById("trend-start"),
    trendEnd: document.getElementById("trend-end"),
    trendSeries: document.getElementById("trend-series"),
    insightCopy: document.getElementById("insight-copy")
};

function isFiniteNumber(value) {
    return typeof value === "number" && Number.isFinite(value);
}

function formatReading(value) {
    return isFiniteNumber(value) ? value.toFixed(1) : "--";
}

function formatDate(value, includeTime = false) {
    const normalizedValue = /^\d{4}-\d{2}-\d{2}$/.test(value)
        ? `${value}T00:00:00`
        : value.replace(" ", "T");
    const date = new Date(normalizedValue);

    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const options = {
        month: "short",
        day: "numeric"
    };

    if (includeTime) {
        options.hour = "numeric";
    }

    return new Intl.DateTimeFormat("en-US", options).format(date);
}

function getSafeTrend(trend) {
    if (!Array.isArray(trend)) {
        return [];
    }

    return trend
        .filter((point) => typeof point.day === "string")
        .map((point) => ({
            day: point.day,
            temperature: isFiniteNumber(point.avg_temperature_c) ? point.avg_temperature_c : null,
            humidity: isFiniteNumber(point.avg_humidity_pct) ? point.avg_humidity_pct : null,
            soilMoisture: isFiniteNumber(point.avg_soil_moisture_pct) ? point.avg_soil_moisture_pct : null
        }));
}

function createTrendLines(points, valueKey, className, startTime, timeRange) {
    const plotLeft = 38;
    const plotWidth = 562;
    const plotTop = 10;
    const plotHeight = 120;
    const values = points
        .map((point) => point[valueKey])
        .filter(isFiniteNumber);

    if (values.length < 2) {
        return [];
    }

    const minimum = Math.min(...values);
    const maximum = Math.max(...values);
    const valueRange = maximum - minimum || 1;
    const segments = [];
    let currentSegment = [];
    let previousTime = null;

    points.forEach((point) => {
        const pointTime = new Date(`${point.day}T00:00:00`).getTime();
        const value = point[valueKey];
        const followsGap = previousTime !== null && pointTime - previousTime > 86400000;

        if (!isFiniteNumber(value) || followsGap) {
            if (currentSegment.length > 1) {
                segments.push(currentSegment);
            }
            currentSegment = [];
        }

        if (!isFiniteNumber(value)) {
            previousTime = pointTime;
            return;
        }

        const normalizedValue = (point[valueKey] - minimum) / valueRange;
        const x = plotLeft + (((pointTime - startTime) / timeRange) * plotWidth);
        const y = plotTop + ((1 - normalizedValue) * plotHeight);
        currentSegment.push(`${x.toFixed(1)},${y.toFixed(1)}`);
        previousTime = pointTime;
    });

    if (currentSegment.length > 1) {
        segments.push(currentSegment);
    }

    return segments.map((coordinates) => {
        const polyline = document.createElementNS(SVG_NS, "polyline");
        polyline.setAttribute("points", coordinates.join(" "));
        polyline.setAttribute("class", `trend-line ${className}`);
        return polyline;
    });
}

function drawTrend(points) {
    if (points.length < 2 || !dashboardElements.trendSeries) {
        return;
    }

    const startTime = new Date(`${points[0].day}T00:00:00`).getTime();
    const endTime = new Date(`${points[points.length - 1].day}T00:00:00`).getTime();
    const timeRange = endTime - startTime || 1;

    const trendLines = [
        ...createTrendLines(points, "temperature", "trend-temperature", startTime, timeRange),
        ...createTrendLines(points, "humidity", "trend-humidity", startTime, timeRange),
        ...createTrendLines(points, "soilMoisture", "trend-moisture", startTime, timeRange)
    ];

    dashboardElements.trendSeries.replaceChildren(...trendLines);

    const startLabel = formatDate(points[0].day);
    const endLabel = formatDate(points[points.length - 1].day);
    dashboardElements.trendStart.textContent = startLabel;
    dashboardElements.trendEnd.textContent = endLabel;
    dashboardElements.trendRange.textContent = `${startLabel}–${endLabel}`;
}

function updateDashboard(data) {
    const current = data && typeof data.current === "object" ? data.current : {};
    const trend = getSafeTrend(data?.trend_30_days);

    dashboardElements.temperature.textContent = formatReading(current.temperature_c);
    dashboardElements.humidity.textContent = formatReading(current.humidity_pct);
    dashboardElements.soilMoisture.textContent = formatReading(current.soil_moisture_pct);

    if (typeof current.plant_status === "string" && current.plant_status.length <= 40) {
        dashboardElements.plantStatus.textContent = current.plant_status;
    }

    if (typeof data.updated_hour === "string") {
        const updatedLabel = formatDate(data.updated_hour, true);
        if (updatedLabel) {
            dashboardElements.updated.textContent = `Updated ${updatedLabel}`;
        }
    }

    if (typeof data.insight === "string" && data.insight.length <= 320) {
        dashboardElements.insightCopy.textContent = data.insight;
    }

    drawTrend(trend);
}

fetch(DATA_URL)
    .then((response) => {
        if (!response.ok) {
            throw new Error("Dashboard data could not be loaded.");
        }
        return response.json();
    })
    .then(updateDashboard)
    .catch(() => {
        // The HTML contains sanitized fallback values for local or offline viewing.
    });
