import { colors, config } from './config.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7/+esm';
import { findFixedDataIndex, getCursorPoint, parseDate } from './helper.js';

class CandleStickChart {
  #colors;
  #config;
  #maxPrice;
  #lockSelectorX;
  #objectIDs;
  #xScaleFunc;
  #yScaleFunc;
  #candleWidth;
  #candleWidthDate;
  #candleLockerWidth;
  #candleLockerWidthDate;
  #filteredData;
  #mode = 'pan';
  #isMouseDown = false;
  #zoomPoint1;
  #zoomPoint2;
  #zoomRange1;
  #zoomRange2;
  #minMaxDate;
  #zoomFactor = 1;
  #panTargetDate;

  constructor(width, height, data, id) {
    this.#colors = colors();
    this.#config = config(width, height);
    this.#maxPrice = d3.max(data.map((x) => x.high));
    this.data = data.sort((a, b) => parseDate(a) - parseDate(b));
    this.#filteredData = data;
    this.id = id;
    this.#lockSelectorX = false;
    this.#calculateExtendConfigs();
    this.#setObjectIDs();
    let minMaxDate = d3.extent(data.map((x) => parseDate(x.date)));
    this.#minMaxDate = minMaxDate;
    this.#zoomRange1 = minMaxDate[0].getTime();
    this.#zoomRange2 = minMaxDate[1].getTime();
    this.#calculateCandleWidthDate();
  }

  #calculateInfoTextWidth() {
    this.#config.infoTextWidth =
      (this.#maxPrice.toFixed(this.#config.decimal).toString().length * 4 +
        11) *
      this.#config.charWidth;
  }

  #calculateInfoTextWidthMeta() {
    this.#config.infoTextWidthMeta =
      (this.#maxPrice.toFixed(this.#config.decimal).toString().length * 3 +
        14) *
      this.#config.charWidth;
  }

  #calculateYLabelWidth() {
    this.#config.yLabelWidth =
      2.5 +
      this.#maxPrice.toFixed(this.#config.decimal).toString().length *
        this.#config.charWidth;
  }

  #calculatePaddingRight() {
    this.#config.paddingRight = this.#config.yLabelWidth;
  }

  #calculateSvgWidth() {
    this.#config.svgWidth =
      this.#config.width -
      (this.#config.paddingLeft + this.#config.paddingRight) -
      2;
  }

  #calculateSvgHeight() {
    this.#config.svgHeight =
      this.#config.height -
      (this.#config.paddingBottom + this.#config.paddingTop + 6);
  }

  #calculateXscale() {
    this.#xScaleFunc = d3
      .scaleTime()
      .domain([this.#zoomRange1, this.#zoomRange2])
      .range([0, this.#config.svgWidth]);
  }

  #calculateYscale() {
    let yMinMax;
    if (this.#filteredData.length === 0) {
      yMinMax = [0, 1];
    } else {
      yMinMax = d3
        .extent([
          ...this.#filteredData.map((x) => x.high),
          ...this.#filteredData.map((x) => x.low),
          ...this.#filteredData.map((x) => x.sl),
          ...this.#filteredData.map((x) => x.tp),
        ])
        .reverse();

      yMinMax[0] += yMinMax[0] * this.#config.yPaddingScaleTop;
      yMinMax[1] -= yMinMax[1] * this.#config.yPaddingScaleBottom;
    }
    this.#yScaleFunc = d3
      .scaleLinear()
      .domain(yMinMax)
      .range([0, this.#config.svgHeight]);
  }

  #calculateCandleWidth() {
    if (this.#filteredData.length === 0) {
      this.#candleLockerWidth = 0;
      this.#candleWidth = 0;
      return;
    }
    let minMax = d3.extent(this.#filteredData.map((x) => parseDate(x.date)));
    this.#candleLockerWidth =
      this.#xScaleFunc(minMax[0].getTime() + this.#candleLockerWidthDate) -
      this.#xScaleFunc(minMax[0].getTime());
    this.#candleWidth = this.#candleLockerWidth - this.#candleLockerWidth * 0.3;
  }

  #calculateCandleWidthDate() {
    let times = this.#filteredData.map((x) => x.date).sort();
    let indexes = [0, 1];
    let min = parseDate(times[1]) - parseDate(times[0]);
    for (let i = 1; i < times.length; i++) {
      if (parseDate(times[i + 1]) - parseDate(times[i]) < min) {
        min = parseDate(times[i + 1]) - parseDate(times[i]);
        indexes = [i, i + 1];
      }
    }

    let rWidth = parseDate(times[indexes[1]]) - parseDate(times[indexes[0]]);
    this.#candleLockerWidthDate = rWidth;
    rWidth -= rWidth * 0.3;
    this.#candleWidthDate = rWidth;
  }

  #calculateExtendConfigs() {
    this.#calculateInfoTextWidth();
    this.#calculateInfoTextWidthMeta();
    this.#calculateYLabelWidth();
    this.#calculatePaddingRight();
    this.#calculateSvgWidth();
    this.#calculateSvgHeight();
  }

  #setObjectIDs() {
    let randomNumber = (Math.random() * 10000).toFixed(0);
    this.#objectIDs = {};
    this.#objectIDs.svgId = `${this.id}-${randomNumber}`;
    this.#objectIDs.yAxisId = `yAxisG-${randomNumber}`;
    this.#objectIDs.xAxisId = `xAxisG-${randomNumber}`;
    this.#objectIDs.candleContainerId = `candles-${randomNumber}`;
    this.#objectIDs.xLineSelectorId = `xLineSelector-${randomNumber}`;
    this.#objectIDs.yLineSelectorId = `yLineSelector-${randomNumber}`;
    this.#objectIDs.xLabelSelectorId = `xLabelSelector-${randomNumber}`;
    this.#objectIDs.yLabelSelectorId = `yLabelSelector-${randomNumber}`;
    this.#objectIDs.candleInfoId = `candle-info-${randomNumber}`;
    this.#objectIDs.candleInfoIdBackground = `bc-candle-info-${randomNumber}`;
    this.#objectIDs.candleInfoIdPosition = `candle-info-${randomNumber}-position`;
    this.#objectIDs.candleInfoIdBackgroundPosition = `bc-candle-info-${randomNumber}-position`;
    this.#objectIDs.zoomBoxId1 = `zoom-box-${randomNumber}-1`;
    this.#objectIDs.zoomBoxId2 = `zoom-box-${randomNumber}-2`;
  }

  #createLayout() {
    d3.select(`#${this.id}`)
      .style(
        'padding',
        `${this.#config.paddingTop}px ${this.#config.paddingRight}px ${
          this.#config.paddingBottom
        }px ${this.#config.paddingLeft}px`
      )
      .style('display', 'inline-block')
      .attr('width', this.#config.width)
      .attr('height', this.#config.height)
      .append('svg')
      .attr('width', this.#config.svgWidth)
      .attr('height', this.#config.svgHeight)
      .style('overflow', 'inherit')
      .style('cursor', 'crosshair')
      .attr('id', this.#objectIDs.svgId);
  }

  #createYaxis() {
    let yAxis = d3.axisRight(this.#yScaleFunc).tickSize(this.#config.svgWidth);
    d3.select(`#${this.#objectIDs.svgId}`)
      .append('g')
      .attr('id', this.#objectIDs.yAxisId)
      .call(yAxis);

    d3.selectAll(`#${this.#objectIDs.yAxisId} .domain`).each(function (d, i) {
      this.remove();
    });

    d3.selectAll(`#${this.#objectIDs.yAxisId}  g text`).attr(
      'transform',
      'translate(5,0)'
    );

    let gridColor = this.#colors.grid;
    d3.selectAll(`#${this.#objectIDs.yAxisId}  .tick line`).each(function (
      d,
      i
    ) {
      this.style.stroke = gridColor;
    });
    d3.selectAll(`#${this.#objectIDs.yAxisId} .tick text`).style(
      'fill',
      this.#colors.tickColor
    );
  }

  #createXaxis() {
    let xAxis = d3
      .axisBottom(this.#xScaleFunc)
      .tickSize(this.#config.svgHeight);

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('g')
      .attr('id', this.#objectIDs.xAxisId)
      .call(xAxis);

    d3.selectAll(`#${this.#objectIDs.xAxisId} g text`).attr(
      'transform',
      'translate(0,10)'
    );

    let gridColor = this.#colors.grid;
    d3.selectAll(`#${this.#objectIDs.xAxisId} .tick line`).each(function (
      d,
      i
    ) {
      this.style.stroke = gridColor;
    });
    d3.selectAll(`#${this.#objectIDs.xAxisId} .domain`).each(function (d, i) {
      this.remove();
    });
    d3.selectAll(`#${this.#objectIDs.xAxisId} .tick text`).style(
      'fill',
      this.#colors.tickColor
    );
  }

  #createInfoText() {
    d3.select(`#${this.#objectIDs.svgId}`)
      .append('rect')
      .attr('id', this.#objectIDs.candleInfoIdBackground)
      .attr('x', 20)
      .attr('y', 10)
      .attr('width', this.#config.infoTextWidth)
      .attr('height', 14)
      .attr('fill', this.#colors.background)
      .style('display', 'none');

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('text')
      .attr('id', this.#objectIDs.candleInfoId)
      .style('font-size', '14px')
      .style('font-family', 'monospace')
      .attr('x', 20)
      .attr('y', 20)
      .style('fill', this.#colors.candleInfoText);

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('rect')
      .attr('id', this.#objectIDs.candleInfoIdBackgroundPosition)
      .attr('x', 20)
      .attr('y', 30)
      .attr('width', this.#config.infoTextWidthMeta)
      .attr('height', 14)
      .attr('fill', this.#colors.background)
      .style('display', 'none');

    d3.select(`#${this.#objectIDs.svgId}`)
      .append('text')
      .attr('id', this.#objectIDs.candleInfoIdPosition)
      .style('font-size', '14px')
      .style('font-family', 'monospace')
      .attr('x', 20)
      .attr('y', 40)
      .style('fill', this.#colors.candleInfoText);
  }
  #createLockerGroup() {
    d3.select(`#${this.#objectIDs.svgId}`)
      .append('foreignObject')
      .attr('width', this.#config.svgWidth)
      .attr('height', this.#config.svgHeight)
      .selectAll()
      .data([1])
      .enter()
      .append('svg')
      .attr('id', this.#objectIDs.candleContainerId)
      .style('width', '100%')
      .style('height', '100%')
      .selectAll()
      .data(this.#filteredData)
      .enter()
      .append('g')
      .attr('class', 'candle-locker');
  }
  #createLockerBody() {
    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle-locker`)
      .append('rect')
      .attr('width', this.#candleLockerWidth)
      .attr('height', this.#config.svgHeight)
      .attr(
        'x',
        (d) => this.#xScaleFunc(parseDate(d.date)) - this.#candleLockerWidth / 2
      )
      .attr('y', 0)
      .style('opacity', 0);
  }

  #createCandlesGroup() {
    d3.select(
      `#${this.#objectIDs.svgId} foreignObject #${
        this.#objectIDs.candleContainerId
      }`
    )
      .selectAll()
      .data(this.#filteredData)
      .enter()
      .append('g')
      .attr('class', 'candle');
  }

  #createCandlesBody() {
    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .append('rect')
      .attr('width', this.#candleWidth)
      .attr('height', (d) =>
        d.open > d.close
          ? this.#yScaleFunc(d.close) - this.#yScaleFunc(d.open)
          : this.#yScaleFunc(d.open) - this.#yScaleFunc(d.close)
      )
      .attr(
        'x',
        (d) => this.#xScaleFunc(parseDate(d.date)) - this.#candleWidth / 2
      )
      .attr('y', (d) =>
        d.open > d.close ? this.#yScaleFunc(d.open) : this.#yScaleFunc(d.close)
      )
      .attr('stroke', (d) =>
        d.open > d.close
          ? this.#colors.upCandlesStroke
          : this.#colors.downCandlesStroke
      )
      .attr('fill', (d) =>
        d.open > d.close
          ? this.#colors.upCandlesFill
          : this.#colors.downCandlesFill
      );
  }

  #createCandlesHigh() {
    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .append('rect')
      .attr('width', this.#config.candleTailWidth)
      .attr('height', (d) =>
        d.open > d.close
          ? this.#yScaleFunc(d.open) - this.#yScaleFunc(d.high)
          : this.#yScaleFunc(d.close) - this.#yScaleFunc(d.high)
      )
      .attr(
        'x',
        (d) =>
          this.#xScaleFunc(parseDate(d.date)) - this.#config.candleTailWidth / 2
      )
      .attr('y', (d) => this.#yScaleFunc(d.high))
      .attr('fill', (d) =>
        d.open > d.close
          ? this.#colors.upCandlesTail
          : this.#colors.downCandlesTail
      );
  }

  #createCandlesLow() {
    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .append('rect')
      .attr('width', this.#config.candleTailWidth)
      .attr('height', (d) =>
        d.open > d.close
          ? this.#yScaleFunc(d.low) - this.#yScaleFunc(d.close)
          : this.#yScaleFunc(d.low) - this.#yScaleFunc(d.open)
      )
      .attr(
        'x',
        (d) =>
          this.#xScaleFunc(parseDate(d.date)) - this.#config.candleTailWidth / 2
      )
      .attr('y', (d) =>
        d.open > d.close ? this.#yScaleFunc(d.close) : this.#yScaleFunc(d.open)
      )
      .attr('fill', (d) =>
        d.open > d.close
          ? this.#colors.upCandlesTail
          : this.#colors.downCandlesTail
      );
  }

  #createShortPositions() {
    d3.select(
      `#${this.#objectIDs.svgId} foreignObject #${
        this.#objectIDs.candleContainerId
      }`
    )
      .selectAll()
      .data(this.#filteredData.filter((x) => x.short))
      .enter()
      .append('polygon')
      .attr(
        'points',
        (d) =>
          `${
            this.#xScaleFunc(parseDate(d.date)) - this.#candleWidth / 1.2
          },${this.#yScaleFunc(d.short)} ${
            this.#xScaleFunc(parseDate(d.date)) + this.#candleWidth / 1.2
          },${this.#yScaleFunc(d.short)} ${this.#xScaleFunc(
            parseDate(d.date)
          )},${this.#yScaleFunc(d.short) + this.#candleWidth * 1.2}`
      )
      .attr('fill', this.#colors.short)
      .attr('stroke', this.#colors.shortStroke)
      .attr('class', 'short');
  }

  #createLongPositions() {
    d3.select(
      `#${this.#objectIDs.svgId} foreignObject #${
        this.#objectIDs.candleContainerId
      }`
    )
      .selectAll()
      .data(this.#filteredData.filter((x) => x.long))
      .enter()
      .append('polygon')
      .attr(
        'points',
        (d) =>
          `${
            this.#xScaleFunc(parseDate(d.date)) - this.#candleWidth / 1.2
          },${this.#yScaleFunc(d.long)} ${
            this.#xScaleFunc(parseDate(d.date)) + this.#candleWidth / 1.2
          },${this.#yScaleFunc(d.long)} ${this.#xScaleFunc(
            parseDate(d.date)
          )},${this.#yScaleFunc(d.long) - this.#candleWidth * 1.2}`
      )
      .attr('fill', this.#colors.long)
      .attr('stroke', this.#colors.longStroke)
      .attr('class', 'long');
  }

  #createStopLosses() {
    d3.select(
      `#${this.#objectIDs.svgId} foreignObject #${
        this.#objectIDs.candleContainerId
      }`
    )
      .selectAll()
      .data(this.#filteredData.filter((x) => x.short || x.long))
      .enter()
      .append('rect')
      .attr('width', this.#candleWidth * 1.6)
      .attr('height', 3)
      .attr(
        'x',
        (d) => this.#xScaleFunc(parseDate(d.date)) - this.#candleWidth / 1.2
      )
      .attr('y', (d) => this.#yScaleFunc(d.sl))
      .attr('fill', this.#colors.sl)
      .attr('stroke', this.#colors.slStroke)
      .attr('class', 'sl');
  }

  #createTakeProfits() {
    d3.select(
      `#${this.#objectIDs.svgId} foreignObject #${
        this.#objectIDs.candleContainerId
      }`
    )
      .selectAll()
      .data(this.#filteredData.filter((x) => x.short || x.long))
      .enter()
      .append('rect')
      .attr('width', this.#candleWidth * 1.6)
      .attr('height', 3)
      .attr(
        'x',
        (d) => this.#xScaleFunc(parseDate(d.date)) - this.#candleWidth / 1.2
      )
      .attr('y', (d) => this.#yScaleFunc(d.tp))
      .attr('fill', this.#colors.tp)
      .attr('stroke', this.#colors.tpStroke)
      .attr('class', 'tp');
  }

  #xLineHandler(d, position) {
    let xPosition;
    if (position) xPosition = position;
    else xPosition = this.#xScaleFunc(parseDate(d.date));

    let xLine = document.getElementById(this.#objectIDs.xLineSelectorId);

    if (xLine) {
      d3.select(xLine)
        .attr('x1', xPosition)
        .attr('y1', 0)
        .attr('x2', xPosition)
        .attr('y2', this.#config.svgHeight);
    } else {
      d3.select(`#${this.#objectIDs.svgId}`)
        .insert('line', `#${this.#objectIDs.xAxisId}`)
        .attr('id', this.#objectIDs.xLineSelectorId)
        .attr('stroke', this.#colors.selectorLine)
        .attr('stroke-dasharray', this.#config.selectoreStrokeDashArray)
        .attr('x1', xPosition)
        .attr('y1', 0)
        .attr('x2', xPosition)
        .attr('y2', this.#config.svgHeight);
    }
  }

  #xLabelHandler(d, position) {
    let xPosition;
    if (position) xPosition = position;
    else xPosition = this.#xScaleFunc(parseDate(d.date));

    let xLabel = document.getElementById(this.#objectIDs.xLabelSelectorId);
    if (xLabel) {
      d3.select(xLabel).attr(
        'transform',
        `translate(
      ${
        xPosition >= this.#config.svgWidth - this.#config.xLabelWidth / 2
          ? this.#config.svgWidth - this.#config.xLabelWidth
          : xPosition <= this.#config.xLabelWidth / 2
          ? 0
          : xPosition - this.#config.xLabelWidth / 2
      },${this.#config.svgHeight})`
      );
      document.querySelector(
        `#${this.#objectIDs.xLabelSelectorId} text`
      ).innerHTML = d3.timeFormat(this.#config.timeFormat)(
        this.#xScaleFunc.invert(xPosition)
      );
    } else {
      d3.select(`#${this.#objectIDs.svgId}`)
        .append('g')
        .attr('id', this.#objectIDs.xLabelSelectorId)
        .attr(
          'transform',
          `translate(
          ${
            xPosition >= this.#config.svgWidth - this.#config.xLabelWidth / 2
              ? this.#config.svgWidth - this.#config.xLabelWidth
              : xPosition <= this.#config.xLabelWidth / 2
              ? 0
              : xPosition - this.#config.xLabelWidth / 2
          },${this.#config.svgHeight})`
        );

      d3.select(`#${this.#objectIDs.xLabelSelectorId}`)
        .append('rect')
        .attr('fill', this.#colors.selectorLableBackground)
        .attr('width', this.#config.xLabelWidth)
        .attr('height', this.#config.xLabelHeight);

      d3.select(`#${this.#objectIDs.xLabelSelectorId}`)
        .append('text')
        .style('font-size', `${this.#config.xLabelFontSize}px`)
        .attr('fill', this.#colors.selectorLabelText)
        .style('font-family', 'monospace')
        .attr('x', 10)
        .attr('y', 15);

      document.querySelector(
        `#${this.#objectIDs.xLabelSelectorId} text`
      ).innerHTML = d3.timeFormat(this.#config.timeFormat)(
        this.#xScaleFunc.invert(xPosition)
      );
    }
  }

  #yLineHandler(d, position) {
    let yLine = document.getElementById(this.#objectIDs.yLineSelectorId);
    if (yLine) {
      d3.select(yLine)
        .attr('x1', 0)
        .attr('y1', position)
        .attr('x2', this.#config.svgWidth)
        .attr('y2', position);
    } else {
      d3.select(`#${this.#objectIDs.svgId}`)
        .insert('line', `#${this.#objectIDs.xAxisId}`)
        .attr('id', this.#objectIDs.yLineSelectorId)
        .attr('stroke', this.#colors.selectorLine)
        .attr('stroke-dasharray', this.#config.selectoreStrokeDashArray)
        .attr('x1', 0)
        .attr('y1', position)
        .attr('x2', this.#config.svgHeight)
        .attr('y2', position);
    }
  }

  #yLabelHandler(d, position) {
    let yLabel = document.getElementById(this.#objectIDs.yLabelSelectorId);
    if (yLabel) {
      d3.select(yLabel).attr(
        'transform',
        `translate(${this.#config.svgWidth},
        ${
          position >= this.#config.svgHeight - this.#config.yLabelHeight / 2
            ? this.#config.svgHeight - this.#config.yLabelHeight
            : position <= this.#config.yLabelHeight / 2
            ? 0
            : position - this.#config.yLabelHeight / 2
        })`
      );
      document.querySelector(
        `#${this.#objectIDs.yLabelSelectorId} text`
      ).innerHTML = this.#yScaleFunc
        .invert(position)
        .toFixed(this.#config.decimal);
    } else {
      d3.select(`#${this.#objectIDs.svgId}`)
        .append('g')
        .attr('id', this.#objectIDs.yLabelSelectorId)
        .attr(
          'transform',
          `translate(${this.#config.svgWidth},
            ${
              position >= this.#config.svgHeight - this.#config.yLabelHeight / 2
                ? this.#config.svgHeight - this.#config.yLabelHeight
                : position <= this.#config.yLabelHeight / 2
                ? 0
                : position - this.#config.yLabelHeight / 2
            })`
        );

      d3.select(`#${this.#objectIDs.yLabelSelectorId}`)
        .append('rect')
        .attr('fill', this.#colors.selectorLableBackground)
        .attr('width', this.#config.yLabelWidth)
        .attr('height', this.#config.yLabelHeight);

      d3.select(`#${this.#objectIDs.yLabelSelectorId}`)
        .append('text')
        .style('font-size', `${this.#config.yLabelFontSize}px`)
        .attr('fill', this.#colors.selectorLabelText)
        .style('font-family', 'monospace')
        .attr('x', 5)
        .attr('y', 15);

      document.querySelector(
        `#${this.#objectIDs.yLabelSelectorId} text`
      ).innerHTML = this.#yScaleFunc.invert(position).toFixed(1);
    }
  }

  #candleInfoHandler(d) {
    let isUp = d.open > d.close;
    document.getElementById(this.#objectIDs.candleInfoId).innerHTML = `
    O <tspan style='fill:${
      isUp ? this.#colors.candleInfoTextUp : this.#colors.candleInfoTextDown
    }'>${d.open.toFixed(this.#config.decimal)}</tspan> 
    H <tspan style='fill:${
      isUp ? this.#colors.candleInfoTextUp : this.#colors.candleInfoTextDown
    }'>${d.high.toFixed(this.#config.decimal)}</tspan> 
    L <tspan style='fill:${
      isUp ? this.#colors.candleInfoTextUp : this.#colors.candleInfoTextDown
    }'>${d.low.toFixed(this.#config.decimal)}</tspan> 
    C <tspan style='fill:${
      isUp ? this.#colors.candleInfoTextUp : this.#colors.candleInfoTextDown
    }'>${d.close.toFixed(this.#config.decimal)}</tspan>`;
    document.getElementById(
      this.#objectIDs.candleInfoIdBackground
    ).style.display = 'block';

    if (d.long || d.short) {
      let text = '';
      if (d.long) {
        text = `Long <tspan style='fill:${this.#colors.long}'> ${d.long.toFixed(
          this.#config.decimal
        )}</tspan>`;
      } else {
        text = `Short <tspan style='fill:${
          this.#colors.short
        }'> ${d.short.toFixed(this.#config.decimal)}</tspan>`;
      }
      text += ` SL <tspan style='fill:${this.#colors.sl}'> ${d.sl.toFixed(
        this.#config.decimal
      )}</tspan>`;
      text += ` TP <tspan style='fill:${this.#colors.tp}'> ${d.tp.toFixed(
        this.#config.decimal
      )}</tspan>`;

      document.getElementById(this.#objectIDs.candleInfoIdPosition).innerHTML =
        text;
      document.getElementById(
        this.#objectIDs.candleInfoIdBackgroundPosition
      ).style.display = 'block';
    }
  }

  #candleInfoLeaveHandler() {
    document.getElementById(this.#objectIDs.candleInfoId).innerHTML = ``;
    document.getElementById(
      this.#objectIDs.candleInfoIdBackground
    ).style.display = 'none';

    document.getElementById(
      this.#objectIDs.candleInfoIdPosition
    ).innerHTML = ``;
    document.getElementById(
      this.#objectIDs.candleInfoIdBackgroundPosition
    ).style.display = 'none';
  }

  #mouseMoveLockers(d) {
    this.#lockSelectorX = true;
    //x line
    this.#xLineHandler(d);

    //x label
    this.#xLabelHandler(d);

    //info
    this.#candleInfoHandler(d);
  }

  #mouseLeaveLocker(d) {
    this.#lockSelectorX = false;
    this.#candleInfoLeaveHandler();
  }

  #handleZoomBox() {
    let zoomBox1 = document.querySelector(`#${this.#objectIDs.zoomBoxId1}`);
    if (zoomBox1) zoomBox1.remove();

    let zoomBox2 = document.querySelector(`#${this.#objectIDs.zoomBoxId2}`);
    if (zoomBox2) zoomBox2.remove();

    let height = document.getElementById(`${this.#objectIDs.candleContainerId}`)
      .height.baseVal.value;
    let width = document.getElementById(`${this.#objectIDs.candleContainerId}`)
      .width.baseVal.value;

    d3.select(`#${this.#objectIDs.candleContainerId}`)
      .selectAll()
      .data([0])
      .enter()
      .append('rect')
      .attr('id', this.#objectIDs.zoomBoxId1)
      .attr(
        'width',
        this.#zoomPoint2 > this.#zoomPoint1
          ? this.#zoomPoint1
          : this.#zoomPoint2
      )
      .attr('x', 0)
      .attr('y', 0)
      .attr('height', height)
      .attr('fill', 'black')
      .attr('stroke', 'none')
      .style('opacity', 0.5);

    d3.select(`#${this.#objectIDs.candleContainerId}`)
      .selectAll()
      .data([0])
      .enter()
      .append('rect')
      .attr('id', this.#objectIDs.zoomBoxId2)
      .attr('width', width - this.#zoomPoint2)
      .attr(
        'x',
        this.#zoomPoint2 > this.#zoomPoint1
          ? this.#zoomPoint2
          : this.#zoomPoint1
      )
      .attr('y', 0)
      .attr('height', height)
      .attr('fill', 'black')
      .attr('stroke', 'none')
      .style('opacity', 0.5);
  }

  #handleZoom() {
    let zoomBox1 = document.querySelector(`#${this.#objectIDs.zoomBoxId1}`);
    if (zoomBox1) zoomBox1.remove();

    let zoomBox2 = document.querySelector(`#${this.#objectIDs.zoomBoxId2}`);
    if (zoomBox2) zoomBox2.remove();

    let minMaxZoom = d3.extent([this.#zoomPoint1, this.#zoomPoint2]);

    let leftDate = parseDate(this.#xScaleFunc.invert(minMaxZoom[0]));
    let rightDate = parseDate(this.#xScaleFunc.invert(minMaxZoom[1]));

    if (leftDate - rightDate === 0) {
      return;
    }

    let filteredData = this.data.filter((x) => {
      return (
        parseDate(x.date).getTime() >
          leftDate.getTime() - this.#candleWidthDate &&
        parseDate(x.date).getTime() <
          rightDate.getTime() + this.#candleWidthDate
      );
    });

    let oldZoomRange1 = this.#minMaxDate[0];
    let oldZoomRange2 = this.#minMaxDate[1];

    let newZoomRange1 = parseDate(this.#xScaleFunc.invert(minMaxZoom[0]));
    let newZoomRange2 = parseDate(this.#xScaleFunc.invert(minMaxZoom[1]));

    this.#zoomFactor =
      (oldZoomRange2 - oldZoomRange1) / (newZoomRange2 - newZoomRange1);

    this.#zoomRange1 = newZoomRange1;
    this.#zoomRange2 = newZoomRange2;

    this.#filteredData = filteredData;
    this.draw();
  }

  #handlePan(location) {
    let dateWidth = this.#zoomRange2 - this.#zoomRange1;
    let width = document.getElementById(
      `${this.#objectIDs.candleContainerId}`
    ).width.baseVal.value;

    let fraction = location / width;

    let newZoomRange1 = this.#panTargetDate - (fraction * dateWidth);
    let newZoomRange2 = newZoomRange1 + dateWidth;


    let filteredData = this.data.filter((x) => {
      return (
        parseDate(x.date).getTime() > newZoomRange1 - this.#candleWidthDate &&
        parseDate(x.date).getTime() < newZoomRange2 + this.#candleWidthDate
      );
    });

    this.#zoomRange1 = newZoomRange1;
    this.#zoomRange2 = newZoomRange2;

    this.#filteredData = filteredData;
    this.draw();
  }

  #addEvenetListeners() {
    let thisProxy = this;
    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle-locker`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .sl`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .tp`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .short`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .long`)
      .on('mouseover', function (e, d) {
        thisProxy.#mouseMoveLockers(d);
      })
      .on('mouseleave', (e, d) => {
        thisProxy.#mouseLeaveLocker(d);
      });

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'mousemove',
      function (e, d) {
        let location = getCursorPoint(thisProxy.#objectIDs.svgId, e);
        if (location.x > thisProxy.#config.width)
          location.x = thisProxy.#config.width;
        if (location.y > thisProxy.#config.height)
          location.y = thisProxy.#config.svgHeight;

        //x line
        if (!thisProxy.#lockSelectorX) thisProxy.#xLineHandler(d, location.x);

        //y line
        thisProxy.#yLineHandler(d, location.y);

        //x label
        if (!thisProxy.#lockSelectorX) {
          thisProxy.#xLabelHandler(d, location.x);
        }

        //y label
        thisProxy.#yLabelHandler(d, location.y);

        if (thisProxy.#isMouseDown && thisProxy.#mode === 'zoom') {
          thisProxy.#zoomPoint2 = location.x;
          thisProxy.#handleZoomBox();
        } else if (thisProxy.#isMouseDown && thisProxy.#mode === 'pan') {
          thisProxy.#handlePan(location.x);
        }
      }
    );

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'mouseleave',
      function (e, d) {
        let xLine = document.getElementById(
          thisProxy.#objectIDs.xLineSelectorId
        );
        let yLine = document.getElementById(
          thisProxy.#objectIDs.yLineSelectorId
        );
        let xLabel = document.getElementById(
          thisProxy.#objectIDs.xLabelSelectorId
        );
        let yLabel = document.getElementById(
          thisProxy.#objectIDs.yLabelSelectorId
        );

        if (xLine) xLine.remove();
        if (yLine) yLine.remove();
        if (xLabel) xLabel.remove();
        if (yLabel) yLabel.remove();
      }
    );

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'mousedown',
      function (e, d) {
        thisProxy.#isMouseDown = true;
        let location = getCursorPoint(thisProxy.#objectIDs.svgId, e);
        if (thisProxy.#mode === 'zoom') {
          thisProxy.#zoomPoint1 = location.x;
        } else if (thisProxy.#mode === 'pan') {
          thisProxy.#panTargetDate = (thisProxy.#xScaleFunc.invert(location.x)).getTime();
        }
      }
    );

    d3.select(`#${this.#objectIDs.candleContainerId}`).on(
      'mouseup',
      function (e, d) {
        thisProxy.#isMouseDown = false;
        if (thisProxy.#mode === 'zoom') {
          thisProxy.#handleZoom();
          thisProxy.#zoomPoint1 = 0;
          thisProxy.#zoomPoint2 = 0;
        } else if (thisProxy.#mode === 'pan') {
          thisProxy.#panTargetDate = 0;
        }
      }
    );
  }

  #removeEventListeners() {
    if (!this.#objectIDs.candleContainerId) return;

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle`)
      .on('mouseover', function (e, d) {
        null;
      })
      .on('mouseleave', (e, d) => {
        null;
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .candle-locker`)
      .on('mouseover', function (e, d) {
        null;
      })
      .on('mouseleave', (e, d) => {
        null;
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .sl`)
      .on('mouseover', function (e, d) {
        null;
      })
      .on('mouseleave', (e, d) => {
        null;
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .tp`)
      .on('mouseover', function (e, d) {
        null;
      })
      .on('mouseleave', (e, d) => {
        null;
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .short`)
      .on('mouseover', function (e, d) {
        null;
      })
      .on('mouseleave', (e, d) => {
        null;
      });

    d3.selectAll(`#${this.#objectIDs.candleContainerId} .long`)
      .on('mouseover', function (e, d) {
        null;
      })
      .on('mouseleave', (e, d) => {
        null;
      });

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mousemove', null);

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mouseleave', null);

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mousedown', null);

    d3.select(`#${this.#objectIDs.candleContainerId}`).on('mouseup', null);
  }

  setColors(colorObj) {
    for (const key in colorObj) {
      let color = colorObj[key];
      this.#colors[key] = color;
    }
  }

  setConfig(configObj) {
    for (const key in configObj) {
      let config = configObj[key];
      this.#config[key] = config;
    }

    this.#calculateExtendConfigs();
  }

  getColors() {
    return this.#colors;
  }

  getConfig() {
    return {
      candleTailWidth: this.#config.candleTailWidth,
      width: this.#config.width,
      height: this.#config.height,
      xLabelFontSize: this.#config.xLabelFontSize,
      yLabelFontSize: this.#config.yLabelFontSize,
      decimal: this.#config.decimal,
      timeFormat: this.#config.timeFormat,
    };
  }

  destroy() {
    this.#removeEventListeners();
    if (document.getElementById(this.#objectIDs.svgId))
      document.getElementById(this.#objectIDs.svgId).remove();
  }

  draw() {
    this.destroy();

    this.#createLayout();
    this.#calculateXscale();
    this.#calculateYscale();
    this.#calculateCandleWidth();
    this.#createYaxis();
    this.#createXaxis();
    this.#createInfoText();
    this.#createLockerGroup();
    this.#createLockerBody();
    this.#createCandlesGroup();
    this.#createCandlesBody();
    this.#createCandlesHigh();
    this.#createCandlesLow();
    this.#createShortPositions();
    this.#createLongPositions();
    this.#createStopLosses();
    this.#createTakeProfits();

    this.#addEvenetListeners();

    let newThis = this;
    let zoom = d3.zoom().on('zoom', function (e) {
      let location = getCursorPoint(newThis.#objectIDs.svgId, e.sourceEvent);
      newThis.#zoomFactor *= e.transform.k > 1 ? 1.1 : 0.9;

      let width =
        parseDate(newThis.#minMaxDate[1]) - parseDate(newThis.#minMaxDate[0]);

      let newWidth = Math.round(width / newThis.#zoomFactor);

      let svgWidth = document.getElementById(
        `${newThis.#objectIDs.candleContainerId}`
      ).width.baseVal.value;

      let target = newThis.#xScaleFunc.invert(location.x).getTime();
      let coeff = Math.round((newWidth * location.x) / svgWidth);
      let left = target - coeff;
      let right = left + newWidth;

      newThis.#zoomRange1 = left;
      newThis.#zoomRange2 = right;

      let filteredData = newThis.data.filter((x) => {
        return (
          parseDate(x.date).getTime() > left - newThis.#candleWidthDate &&
          parseDate(x.date).getTime() < right + newThis.#candleWidthDate
        );
      });

      newThis.#filteredData = filteredData;

      newThis.draw();
    });
    d3.select('svg')
      .call(zoom)
      .on('mousedown.zoom', null)
      .on('touchstart.zoom', null)
      .on('touchmove.zoom', null)
      .on('touchend.zoom', null);
  }
}

export default CandleStickChart;
