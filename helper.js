export const parseDate = (dateStr) => new Date(dateStr);

export const getCursorPoint = (id, evt) => {
  let svg = document.querySelector(`#${id}`);
  let pt = svg.createSVGPoint();
  let cursorPoint = (evt) => {
    if (evt.touches && evt.touches[0]) {
      pt.x = evt.touches[0].clientX;
      pt.y = evt.touches[0].clientY;
    } else {
      pt.x = evt.clientX;
      pt.y = evt.clientY;
    }

    return pt.matrixTransform(svg.getScreenCTM().inverse());
  };

  return cursorPoint(evt);
};

export const findFixedDataIndex = (dataPoint, data) => {
  let index = 0;
  let min = Math.abs(parseDate(dataPoint) - parseDate(data[0].date));
  for (let i = 0; i < data.length; i++) {
    let newMin = Math.abs(parseDate(dataPoint) - parseDate(data[i].date));
    if (newMin < min) {
      min = newMin;
      index = i;
    }
  }
  return index;
};
