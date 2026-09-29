/**
 * Which section of a recipe page its pinned subheader names (components/recipe-detail/
 * RecipeSubheader): the section whose own heading has scrolled up under the bar while the rest
 * of it is still on screen. A section that fits on screen never needs the bar, since its heading
 * is still in view whenever any of it is. For the ingredients it also names the group (the
 * heading such as "For the sauce") being read, the same way.
 */

/** Where a section or group is on screen, in viewport pixels. */
export interface SubheaderBox {
  name: string;
  /** The bottom of its own heading. */
  headingBottom: number;
  /** The bottom of the whole section or group. */
  bottom: number;
}

export interface SubheaderSection extends SubheaderBox {
  groups: SubheaderBox[];
}

export interface SubheaderAt {
  /** The section's place on the page, so the bar's name rolls the way the page moved. */
  index: number;
  title: string;
  /** The group being read, or '' when none is. */
  group: string;
  groupIndex: number;
}

/**
 * The bar gives way this far before the section's end reaches it, so it never names a section
 * that has only a sliver left on screen.
 */
export const SUBHEADER_TAIL = 48;

/** The part the bar names: its heading under the bar, and more than a sliver of it left below. */
function isUnderBar(box: SubheaderBox, barBottom: number, tail: number) {
  return box.headingBottom <= barBottom && box.bottom > barBottom + tail;
}

/** What the bar should name when its bottom edge is at `barBottom`, or null for no bar. */
export function subheaderAt(sections: SubheaderSection[], barBottom: number): SubheaderAt | null {
  for (let index = sections.length - 1; index >= 0; index--) {
    const section = sections[index];
    if (!isUnderBar(section, barBottom, SUBHEADER_TAIL)) continue;
    let group = '';
    let groupIndex = -1;
    section.groups.forEach((box, g) => {
      if (isUnderBar(box, barBottom, SUBHEADER_TAIL / 2)) {
        group = box.name;
        groupIndex = g;
      }
    });
    return { index, title: section.name, group, groupIndex };
  }
  return null;
}

/** Whether two answers show the same thing, so an unchanged bar isn't redrawn while scrolling. */
export function sameSubheader(a: SubheaderAt | null, b: SubheaderAt | null): boolean {
  if (!a || !b) return a === b;
  return (
    a.index === b.index &&
    a.title === b.title &&
    a.groupIndex === b.groupIndex &&
    a.group === b.group
  );
}
