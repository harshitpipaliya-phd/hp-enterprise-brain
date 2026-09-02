import { formatValue } from '../../intelligence/parts';
import type { Tile } from '../../../api/departmentIntelligence';

/**
 * THE SIX FIGURES THE UNIT IS READ BY.
 *
 * A tile with no value shows the SENTENCE saying why, at the size of a
 * supporting line rather than a headline. It never shows 0 and never shows a
 * dash: "no open work" and "open work is not recorded" are opposite readings of
 * the same tile, and a zero makes them identical.
 *
 * The tone is carried by the sub-line's colour AND its words, so the tile still
 * reads correctly in greyscale and to a screen reader.
 */
export function StatTiles({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="dv-tiles">
      {tiles.map((tile) => {
        const measured = tile.value !== null;

        return (
          <div className="dv-tile" key={tile.key}>
            <div className="dv-tile__k">{tile.label}</div>
            <div className={`dv-tile__v${measured ? '' : ' dv-tile__v--none'}`}>
              {measured ? formatValue(tile.value as number, tile.format) : 'Not measurable'}
            </div>
            <div className="dv-tile__s" data-tone={measured ? tile.tone : 'neutral'}>
              {measured ? tile.hint : tile.reason}
            </div>
          </div>
        );
      })}
    </div>
  );
}
