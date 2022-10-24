const lineWidth_thin = {
  stops: [
    [ 10, .4 ],
    [ 20, 1 ]
  ]
}
const lineWidth_bold = {
  stops: [
    [ 10, 1 ],
    [ 20, 5 ]
  ]
}

const layers = {
  "地理院ベースマップ標準地図": [
    {
      "type": "raster",
      "source": "gis_bg",
      "layout": {
        "visibility": "none"
      },
      "metadata": {
        "defaultHidden": true,
      }
    }
  ],
  "工事現場背景地図": [
    {
      "type": "line",
      "source": "cmap",
      "paint": {
        "line-color": "#000",
        "line-width": lineWidth_thin,
      }
    }
  ],
  "空間IDグリッド": [
    {
      "source": "grids",
      "type": "line",
      "paint": {
        "line-color": "#777",
        "line-opacity": 1,
        "line-width": 0.1,
      }
    },
    // {
    //   "source": "grids",
    //   "type": "symbol",
    //   "layout": {
    //     "text-field": "{id}",
    //     "text-font": ["Noto Sans CJK JP Regular"],
    //     "text-size": 10,
    //   },
    // },
  ],
  "地物空間IDグリッド": [
    {
      "source": "cmap-spaces",
      "type": "fill",
      "paint": {
        "fill-color": "#67b57c",
        "fill-opacity": 0.2
      }
    }
  ]
}

const layerList = document.getElementById('layer-list')
const legendContainer = document.getElementById('legend-container')
const tableContainer = document.getElementById('table-container')

const all_checks = []

let currentZoom = 14;
const zoomAdd = 5;
const rangeController = document.getElementById("range-controller");
const rangeIndicator = document.getElementById("range-indicator");

const map = new window.geolonia.Map('#map')

const draw = new MapboxDraw({
  displayControlsDefault: false,
  controls: {
    polygon: true,
    trash: true,
  },
});
window._mapDraw = draw;
map.addControl(draw, 'top-left');

const refreshGrids = () => {
  const bounds = map.getBounds();
  const sw = bounds.getSouthWest();
  const ne = bounds.getNorthEast();
  const bbox = [sw.lng, sw.lat, ne.lng, ne.lat];
  const polygon = turf.bboxPolygon(bbox);
  const spaces = SpatialId.Space.spacesForPolygon(polygon, currentZoom);
  // console.log(spaces.map(s => s.zfxyStr));
  const features = spaces.map(s => {
    const polygon = s.toGeoJSON();
    return turf.feature(polygon, {id: s.zfxyStr});
  });
  const geojson = turf.featureCollection(features);
  map.getSource('grids').setData(geojson);
}

const refreshCMapSpaces = () => {
  const originalPolygons = draw.getAll();
  const features = [];
  for (const polygon of originalPolygons.features) {
    const id = polygon.id;
    const spaces = SpatialId.Space.spacesForPolygon(polygon, currentZoom);
    const spaceFeatures = spaces.map(s => {
      const polygon = s.toGeoJSON();
      return turf.feature(polygon, { spatialId: s.zfxyStr, cmapId: id });
    });
    features.push(...spaceFeatures);
  }

  for (const cmapFeature of map.getSource('cmap')._data.features) {
    const spaces = SpatialId.Space.spacesForPolygon(cmapFeature.geometry, currentZoom);
    const spaceFeatures = spaces.map(s => {
      const polygon = s.toGeoJSON();
      return turf.feature(polygon, {
        spatialId: s.zfxyStr,
        constructionMapId: cmapFeature.id,
        ...cmapFeature.properties,
      });
    });
    features.push(...spaceFeatures);
  }

  const geojson = turf.featureCollection(features);
  map.getSource('cmap-spaces').setData(geojson);
}

const refreshSelected = () => {
  const features = draw.getSelected().features;
  legendContainer.innerHTML = '';
  for (const feature of features) {
    const area = Math.round(turf.area(feature) * 100) / 100;
    const html = `<div class="border p-2"><h5>選択中地物</h5><ul class="mb-0"><li>面積: ${area}m<sup>2</sup></li></ul></div>`;
    legendContainer.insertAdjacentHTML('beforeend', html);
  }
}

map
  .on('load', () => {
    map.setMaxPitch(0);

    const newZoom = Math.min(Math.round(map.getZoom() + zoomAdd), 25);
    currentZoom = rangeController.value = rangeIndicator.innerHTML = newZoom;

    const sourceId = 'spatial-id-chosa'

    // 全てを選択チェックを作成
    const toggle_all_item = document.createElement('li')
    toggle_all_item.className = 'list-group-item'

    const togge_all_check = document.createElement('input')
    togge_all_check.className = 'form-check-input me-1'
    togge_all_check.type = 'checkbox'
    togge_all_check.id = 'toggle-all'
    togge_all_check.checked = true

    const toggle_all_label = document.createElement('label')
    toggle_all_label.className = 'fw-bold'
    toggle_all_label.textContent = '全てを選択'
    toggle_all_label.htmlFor = 'toggle-all'

    toggle_all_item.append(togge_all_check)
    toggle_all_item.append(toggle_all_label)
    layerList.append(toggle_all_item)

    for (const layer_name in layers) {
      // 個別レイヤのチェックを作成
      const layer_item = document.createElement('li')
      layer_item.className = 'list-group-item'

      const layer_check = document.createElement('input')
      layer_check.className = 'form-check-input me-1'
      layer_check.type = 'checkbox'
      layer_check.id = layer_name
      layer_check.checked = true
      layer_check.disabled = !layer_check.checked

      const layer_label = document.createElement('label')

      const label_element = document.createElement('span')
      label_element.textContent = layer_name
      layer_label.appendChild(label_element)
      if(layers[layer_name][0]?.metadata?.description) {
        const desc_element = document.createElement('small')
        desc_element.className = 'fw-bold fst-italic'
        desc_element.textContent = layers[layer_name][0].metadata?.description
        layer_label.appendChild(desc_element)
      }
      if(layers[layer_name][0]?.metadata?.textHaloColor) {
        const desc_element = document.createElement('small')
        desc_element.className = 'bg-light py-1 px-2';
        desc_element.style = 'text-shadow: 0 0 2px ' + layers[layer_name][0].metadata?.textHaloColor;
        desc_element.textContent = 'ビル名サンプル'
        layer_label.appendChild(desc_element)
      }
      if (layers[layer_name][0]?.metadata?.defaultHidden) {
        layer_check.checked = false
      }

      layer_label.htmlFor = layer_name

      layer_item.append(layer_check)
      layer_item.append(layer_label)
      layerList.append(layer_item)

      const listener = (e) => {

        const layerPrefix = `${sourceId}-${e.target.id}__`
        const target_layer_ids = map.getStyle().layers.filter(layer => layer.id.startsWith(layerPrefix)).map(layer => layer.id)
        const visibility = e.target.checked ? 'visible' : 'none'
        for (const layer_id of target_layer_ids) {
          map.setLayoutProperty(layer_id, 'visibility', visibility)
        }

      }
      layer_check.addEventListener('change', listener)
      layer_check.__listener = listener
      all_checks.push(layer_check)

      const baseLayerProps = layers[layer_name]
      let index = 0
      for (const baseLayerProp of baseLayerProps) {
        const id = `${sourceId}-${layer_name}__` + (baseLayerProp.id ? baseLayerProp.id : index)
        const layer = {
          id,
          source: sourceId,
          ...baseLayerProp,
          layout: {
            ...baseLayerProp.layout,
          }
        }
        map.addLayer(layer, 'current-space');
        index++
      }
    }

    togge_all_check.addEventListener('change', (e) => {
      all_checks.forEach(check => {
        check.checked = e.target.checked
        check.__listener({ target: { id: check.id, checked: e.target.checked } })
      })
    })

    refreshGrids();
    refreshCMapSpaces();
  })
  .on('zoomend', function() {
    const newZoom = Math.min(Math.round(map.getZoom() + zoomAdd), 25);
    currentZoom = rangeController.value = rangeIndicator.innerHTML = newZoom;
    refreshGrids();
    refreshCMapSpaces();
  })
  .on('click', (e) => {
    const space = new SpatialId.Space({lat: e.lngLat.lat, lng: e.lngLat.lng}, currentZoom);
    const spaceFeatures = map.getSource('cmap-spaces')._data.features.filter(feature => {
      return feature.properties.spatialId === space.zfxyStr;
    });

    map.getSource('space').setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: space.toGeoJSON(),
          properties: {
            id: space.id,
            // f_height: getFloor({...space.zfxy, f: space.zfxy.f + 1}),
            // f_base: getFloor(space.zfxy),
          }
        }
      ]
    });

    // const getFloor = ({f, z}) => f * (2**25) / (2**z);
    let html = '';

    html += '<div>空間ID (zfxy): <code>' + space.zfxyStr + '</code></div>';
    html += '<div>空間ID (hash): <code>' + space.tilehash + '</code></div>';
    html += `<pre class="border p-2" style="max-height: 200px; overflow-y: scroll;"><code>${JSON.stringify(spaceFeatures, null, 2)}</code></pre>`;

    document.getElementById('geojson-container').innerHTML = html;
  })
  // .on('click', async (e) => {
  //   const space = new SpatialId.Space({lat: e.lngLat.lat, lng: e.lngLat.lng}, currentZoom);
  //   const getFloor = ({f, z}) => f * (2**25) / (2**z);

  //   let html = '';
  //   html += '<div>空間ID (zfxy): <code>' + space.zfxyStr + '</code></div>';
  //   html += '<div>空間ID (hash): <code>' + space.tilehash + '</code></div>';
  //   // html += (await Promise.all(
  //   //   Object.entries(map.getStyle().sources).map(async ([src_name, tilejson]) => {
  //   //     if (!tilejson.metadata?.spatialIdSrc) return '';

  //   //     // console.log(tilejson);
  //   //     const resp = await SpatialIdRequest.requestToGeoJSON(tilejson, space);
  //   //     // console.log(src_name, resp);

  //   //     let html = '<details open>';
  //   //     html += '<summary>' + src_name + ` (${resp.features.length})` + '</summary>';
  //   //     html += '<pre class="border p-2" style="max-height: 200px; overflow-y: scroll;"><code>' + JSON.stringify(resp, null, 2) + '</code></pre>';

  //   //     if (src_name === 'fudosan_data') {
  //   //       html += '<div class="border p-2" style="max-height: 200px; overflow-y: scroll;"><ul>';
  //   //       for (const feature of resp.features) {
  //   //         html += '<li><a href="https://tileserver.dejicho-chosa.geolonia-dev.click/fudosan_data/buildings/' + feature.properties['棟ID'] + '" target="_blank">' + feature.properties['棟名'] + '</a></li>';
  //   //       }
  //   //       html += '</ul></div>';
  //   //     }

  //   //     html += '</details>';
  //   //     return html;
  //   //   })
  //   // )).join('');
  //   document.getElementById('geojson-container').innerHTML = html;
  // })
  .on('moveend', () => {
    refreshGrids();
  })
  .on('draw.create', (e) => {
    refreshCMapSpaces();
  })
  .on('draw.update', (e) => {
    refreshCMapSpaces();
    refreshSelected();
  })
  .on('draw.delete', (e) => {
    refreshCMapSpaces();
    refreshSelected();
  })
  .on('draw.selectionchange', (e) => {
    refreshSelected();
  });

window._mainMap = map;

function rangeChangeHandler() {
  rangeIndicator.innerHTML = rangeController.value;
  currentZoom = parseInt(rangeController.value, 10);
  refreshGrids();
  refreshCMapSpaces();
}
rangeController.addEventListener("mouseup", rangeChangeHandler);
rangeController.addEventListener("touchend", rangeChangeHandler);
