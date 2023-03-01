import sourceMap from 'source-map';

export type Position = sourceMap.MappedPosition;

export function calcAccumulatedLineLengths(src: string): number[] {

    let lengths = src.split('\n').map(line => line.length);

    let acc = -1;
    for (let i = 0; i < lengths.length; i++) {
        acc += lengths[i] + 1;
        lengths[i] = acc;
    }

    return [0, ...lengths];
}

// copied from https://github.com/io-monad/line-column/blob/master/lib/line-column.js
export function findLowerIndexInRangeArray(value: number, arr: number[]) {
    if (value >= arr[arr.length - 1]) {
        return arr.length - 1;
    }

    var min = 0, max = arr.length - 2, mid;
    while (min < max) {
        mid = min + ((max - min) >> 1);

        if (value < arr[mid]) {
            max = mid - 1;
        } else if (value >= arr[mid + 1]) {
            min = mid + 1;
        } else { // value >= arr[mid] && value < arr[mid + 1]
            min = mid;
            break;
        }
    }
    return min;
}

// todo - extract into separate function, add tests, rewrite to use log search
export function positionFromOffset(offset: number, accumulatedLineLengths: number[]): Position {

    // return { line: 1, column: 1, source: '' };
    let line = findLowerIndexInRangeArray(offset, accumulatedLineLengths) + 1;
    let column = offset - accumulatedLineLengths[line - 1];
    if (column == 0) column = 1;

    return { line, column, source: '' };
}
