import { moveSelection } from './naturedex-selection';

describe('moveSelection', () => {
  // Two sections: 7 pictures (rows of 5 + 2) and 3 pictures.
  const sizes = [7, 3];
  const at = (section: number, index: number) => ({ section, index });

  it('moves left and right in reading order across sections', () => {
    expect(moveSelection(sizes, at(0, 0), 'MoveRight')).toEqual(at(0, 1));
    expect(moveSelection(sizes, at(0, 6), 'MoveRight')).toEqual(at(1, 0));
    expect(moveSelection(sizes, at(1, 0), 'MoveLeft')).toEqual(at(0, 6));
  });

  it('stays at the first and last picture', () => {
    expect(moveSelection(sizes, at(0, 0), 'MoveLeft')).toEqual(at(0, 0));
    expect(moveSelection(sizes, at(0, 0), 'MoveUp')).toEqual(at(0, 0));
    expect(moveSelection(sizes, at(1, 2), 'MoveRight')).toEqual(at(1, 2));
    expect(moveSelection(sizes, at(1, 2), 'MoveDown')).toEqual(at(1, 2));
  });

  it('moves up and down by one row in the same column', () => {
    expect(moveSelection(sizes, at(0, 1), 'MoveDown')).toEqual(at(0, 6));
    expect(moveSelection(sizes, at(0, 6), 'MoveUp')).toEqual(at(0, 1));
  });

  it('clamps to the last picture of a shorter row below', () => {
    expect(moveSelection(sizes, at(0, 4), 'MoveDown')).toEqual(at(0, 6));
  });

  it('continues into the adjacent section in the same column', () => {
    expect(moveSelection(sizes, at(0, 5), 'MoveDown')).toEqual(at(1, 0));
    expect(moveSelection(sizes, at(0, 6), 'MoveDown')).toEqual(at(1, 1));
    expect(moveSelection(sizes, at(1, 1), 'MoveUp')).toEqual(at(0, 6));
    expect(moveSelection(sizes, at(1, 2), 'MoveUp')).toEqual(at(0, 6));
  });

  it('skips empty sections', () => {
    expect(moveSelection([2, 0, 2], at(0, 1), 'MoveRight')).toEqual(at(2, 0));
    expect(moveSelection([2, 0, 2], at(2, 0), 'MoveUp')).toEqual(at(0, 0));
  });

  it('ignores other actions', () => {
    expect(moveSelection(sizes, at(0, 3), 'Confirm')).toEqual(at(0, 3));
  });
});
