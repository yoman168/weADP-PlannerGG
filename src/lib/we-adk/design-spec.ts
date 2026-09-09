/**
 * A screen, written down.
 *
 * The export already carries every design as html, which is the right artefact
 * for a person: they open it and see the screen. It is the wrong one for
 * building from — an html file is a rendering, and reading a layout back out of
 * markup means guessing which parts were decisions and which were the renderer.
 *
 * So each design is also described: block by block, in the order it is drawn,
 * with the labels, columns, options and buttons that make it that screen rather
 * than a generic one. That description is what someone — or something — builds
 * from, and it is short enough to read beside the picture.
 *
 * The block model lives in the mock layer and the report takes plain data, so
 * this sits between them and belongs to neither.
 */

import { BLOCK_CATALOG, type CanvasBlock } from '@/lib/we-adk-mock/sketcher';
import { type ReportBlock } from '@/lib/we-adk/version-report';

/** `a, b, c` — or nothing at all, so an empty list never prints as `: `. */
function list(values: (string | undefined)[] | undefined): string | undefined {
  const kept = (values ?? []).filter((value): value is string => !!value && value.trim() !== '');
  return kept.length === 0 ? undefined : kept.join(', ');
}

/**
 * What a block is, past its type.
 *
 * One line per block, and only what a builder could not infer: a table's
 * columns, a select's options, the labels on a button bar. The generic
 * properties every block has — width, alignment, spacing — are layout the
 * html already shows, and repeating them here would bury the four facts that
 * matter in forty that do not.
 */
function detail(block: CanvasBlock): string | undefined {
  const props = block.props;
  const parts: string[] = [];

  switch (block.kind) {
    case 'table': {
      const columns = list(props.columns);
      if (columns) parts.push(`Columns: ${columns}`);
      if (props.data && props.data.length > 0) parts.push(`${props.data.length} rows of real data`);
      else if (props.rows) parts.push(`${props.rows} sample rows`);
      if (props.showActions) parts.push('row actions');
      break;
    }
    case 'filterBar': {
      const controls = list(
        props.controls?.map((control) => {
          const options = list(control.options);
          const name = control.label ?? control.placeholder ?? control.type;
          return options ? `${name} [${options}]` : `${name} (${control.type})`;
        }),
      );
      if (controls) parts.push(controls);
      break;
    }
    case 'buttonBar': {
      const buttons = list(
        props.buttons?.map(
          (button) => `${button.label}${button.variant === 'default' ? ' (primary)' : ''}`,
        ),
      );
      if (buttons) parts.push(buttons);
      break;
    }
    case 'statusTabs': {
      const tabs = list(props.tabs?.map((tab) => `${tab.label} (${tab.count})`));
      if (tabs) parts.push(tabs);
      break;
    }
    case 'statCards':
    case 'keyValue':
    case 'toggleList':
    case 'taskList':
    case 'timeline':
    case 'fileList':
    case 'metricBars': {
      const pairs = list(props.pairs?.map((pair) => `${pair.key}: ${pair.value}`));
      if (pairs) parts.push(pairs);
      break;
    }
    case 'select':
    case 'radioGroup':
    case 'segmented':
    case 'autocomplete': {
      const options = list(props.options);
      if (options) parts.push(`Options: ${options}`);
      break;
    }
    case 'badgeRow': {
      const badges = list(props.badges);
      if (badges) parts.push(badges);
      break;
    }
    case 'dateRange': {
      const ranges = list(props.quickRanges);
      if (ranges) parts.push(`Quick ranges: ${ranges}`);
      break;
    }
    default:
      break;
  }

  // True of any block that carries them, whatever its kind.
  if (props.subtitle) parts.push(`Subtitle: ${props.subtitle}`);
  if (props.placeholder) parts.push(`Placeholder: ${props.placeholder}`);
  if (props.value) parts.push(`Value: ${props.value}`);
  if (props.required) parts.push('Required');
  if (props.helpText) parts.push(props.helpText);

  return parts.length === 0 ? undefined : parts.join(' · ');
}

/**
 * A canvas as a numbered list of its blocks.
 *
 * Hidden blocks are left out: they are not on the screen, and a specification
 * that lists them describes something nobody has ever seen.
 */
export function describeBlocks(blocks: CanvasBlock[]): ReportBlock[] {
  return blocks
    .filter((block) => !block.hidden)
    .map((block) => ({
      kind: BLOCK_CATALOG[block.kind]?.label ?? block.kind,
      label: block.props.label,
      detail: detail(block),
    }));
}
