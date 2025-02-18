import { useStorybookApi } from '@storybook/api';
import type { StoriesHash, GroupEntry, ComponentEntry, StoryEntry } from '@storybook/api';
import { styled } from '@storybook/theming';
import { Button, Icons } from '@storybook/components';
import { transparentize } from 'polished';
import type { MutableRefObject } from 'react';
import React, { useCallback, useMemo, useRef } from 'react';

import { PRELOAD_ENTRIES } from '@storybook/core-events';
import {
  ComponentNode,
  DocumentNode,
  GroupNode,
  RootNode,
  StoryNode,
  CollapseIcon,
} from './TreeNode';

import type { ExpandAction, ExpandedState } from './useExpanded';
// eslint-disable-next-line import/no-cycle
import { useExpanded } from './useExpanded';
import type { Highlight, Item } from './types';
// eslint-disable-next-line import/no-cycle
import { isStoryHoistable, createId, getAncestorIds, getDescendantIds, getLink } from './utils';

export const Action = styled.button(({ theme }) => ({
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  margin: 0,
  marginLeft: 'auto',
  padding: 0,
  outline: 0,
  lineHeight: 'normal',
  background: 'none',
  border: `1px solid transparent`,
  borderRadius: '100%',
  cursor: 'pointer',
  transition: 'all 150ms ease-out',
  color:
    theme.base === 'light'
      ? transparentize(0.3, theme.color.defaultText)
      : transparentize(0.6, theme.color.defaultText),

  '&:hover': {
    color: theme.color.secondary,
  },
  '&:focus': {
    color: theme.color.secondary,
    borderColor: theme.color.secondary,

    '&:not(:focus-visible)': {
      borderColor: 'transparent',
    },
  },

  svg: {
    width: 10,
    height: 10,
  },
}));

const CollapseButton = styled.button(({ theme }) => ({
  // Reset button
  background: 'transparent',
  border: 'none',
  outline: 'none',
  boxSizing: 'content-box',
  cursor: 'pointer',
  position: 'relative',
  textAlign: 'left',
  lineHeight: 'normal',
  font: 'inherit',
  color: 'inherit',
  letterSpacing: 'inherit',
  textTransform: 'inherit',

  display: 'flex',
  flex: '0 1 auto',
  padding: '3px 10px 1px 1px',
  margin: 0,
  marginLeft: -19,
  overflow: 'hidden',
  borderRadius: 26,
  transition: 'color 150ms, box-shadow 150ms',

  'span:first-of-type': {
    marginTop: 4,
    marginRight: 7,
  },

  '&:focus': {
    boxShadow: `0 0 0 1px ${theme.color.secondary}`,
    color: theme.color.secondary,
    'span:first-of-type': {
      color: theme.color.secondary,
    },

    '&:not(:focus-visible)': {
      boxShadow: 'none',
    },
  },
}));

const LeafNodeStyleWrapper = styled.div(({ theme }) => ({
  position: 'relative',
}));

const SkipToContentLink = styled(Button)(({ theme }) => ({
  display: 'none',
  '@media (min-width: 600px)': {
    display: 'block',
    zIndex: -1,
    position: 'absolute',
    top: 1,
    right: 20,
    height: '20px',
    fontSize: '10px',
    padding: '5px 10px',
    '&:focus': {
      background: 'white',
      zIndex: 1,
    },
  },
}));

interface NodeProps {
  item: Item;
  refId: string;
  docsMode: boolean;
  isOrphan: boolean;
  isDisplayed: boolean;
  isSelected: boolean;
  isFullyExpanded?: boolean;
  isExpanded: boolean;
  setExpanded: (action: ExpandAction) => void;
  setFullyExpanded?: () => void;
  onSelectStoryId: (itemId: string) => void;
}

const Node = React.memo<NodeProps>(function Node({
  item,
  refId,
  docsMode,
  isOrphan,
  isDisplayed,
  isSelected,
  isFullyExpanded,
  setFullyExpanded,
  isExpanded,
  setExpanded,
  onSelectStoryId,
}) {
  const api = useStorybookApi();
  if (!isDisplayed) return null;

  const id = createId(item.id, refId);
  if (item.type === 'story' || item.type === 'docs') {
    const LeafNode = item.type === 'docs' ? DocumentNode : StoryNode;
    return (
      <LeafNodeStyleWrapper>
        <LeafNode
          key={id}
          id={id}
          className="sidebar-item"
          data-ref-id={refId}
          data-item-id={item.id}
          data-parent-id={item.parent}
          data-nodetype={item.type === 'docs' ? 'document' : 'story'}
          data-selected={isSelected}
          data-highlightable={isDisplayed}
          depth={isOrphan ? item.depth : item.depth - 1}
          href={getLink(item, refId)}
          onClick={(event) => {
            event.preventDefault();
            onSelectStoryId(item.id);
          }}
          {...(item.type === 'docs' && { docsMode })}
        >
          {(item.renderLabel as (i: typeof item) => React.ReactNode)?.(item) || item.name}
        </LeafNode>
        {isSelected && (
          <SkipToContentLink secondary outline isLink href="#storybook-preview-wrapper">
            Skip to canvas
          </SkipToContentLink>
        )}
      </LeafNodeStyleWrapper>
    );
  }

  if (item.type === 'root') {
    return (
      <RootNode
        key={id}
        id={id}
        className="sidebar-subheading"
        data-ref-id={refId}
        data-item-id={item.id}
        data-nodetype="root"
      >
        <CollapseButton
          type="button"
          data-action="collapse-root"
          onClick={(event) => {
            event.preventDefault();
            setExpanded({ ids: [item.id], value: !isExpanded });
          }}
          aria-expanded={isExpanded}
        >
          <CollapseIcon isExpanded={isExpanded} />
          {item.renderLabel?.(item) || item.name}
        </CollapseButton>
        {isExpanded && (
          <Action
            type="button"
            className="sidebar-subheading-action"
            aria-label="expand"
            data-action="expand-all"
            data-expanded={isFullyExpanded}
            onClick={(event) => {
              event.preventDefault();
              setFullyExpanded();
            }}
          >
            <Icons icon={isFullyExpanded ? 'collapse' : 'expandalt'} />
          </Action>
        )}
      </RootNode>
    );
  }

  const BranchNode = item.type === 'component' ? ComponentNode : GroupNode;
  return (
    <BranchNode
      key={id}
      id={id}
      className="sidebar-item"
      data-ref-id={refId}
      data-item-id={item.id}
      data-parent-id={item.parent}
      data-nodetype={item.type === 'component' ? 'component' : 'group'}
      data-highlightable={isDisplayed}
      aria-controls={item.children && item.children[0]}
      aria-expanded={isExpanded}
      depth={isOrphan ? item.depth : item.depth - 1}
      isComponent={item.type === 'component'}
      isExpandable={item.children && item.children.length > 0}
      isExpanded={isExpanded}
      onClick={(event) => {
        event.preventDefault();
        setExpanded({ ids: [item.id], value: !isExpanded });
        if (item.type === 'component' && !isExpanded) onSelectStoryId(item.id);
      }}
      onMouseEnter={() => {
        if (item.isComponent) {
          api.emit(PRELOAD_ENTRIES, {
            ids: [item.children[0]],
            options: { target: refId },
          });
        }
      }}
    >
      {(item.renderLabel as (i: typeof item) => React.ReactNode)?.(item) || item.name}
    </BranchNode>
  );
});

const Root = React.memo<NodeProps & { expandableDescendants: string[] }>(function Root({
  setExpanded,
  isFullyExpanded,
  expandableDescendants,
  ...props
}) {
  const setFullyExpanded = useCallback(
    () => setExpanded({ ids: expandableDescendants, value: !isFullyExpanded }),
    [setExpanded, isFullyExpanded, expandableDescendants]
  );
  return (
    <Node
      {...props}
      setExpanded={setExpanded}
      isFullyExpanded={isFullyExpanded}
      setFullyExpanded={setFullyExpanded}
    />
  );
});

const Container = styled.div<{ hasOrphans: boolean }>((props) => ({
  marginTop: props.hasOrphans ? 20 : 0,
  marginBottom: 20,
}));

export const Tree = React.memo<{
  isBrowsing: boolean;
  isMain: boolean;
  refId: string;
  data: StoriesHash;
  docsMode: boolean;
  highlightedRef: MutableRefObject<Highlight>;
  setHighlightedItemId: (itemId: string) => void;
  selectedStoryId: string | null;
  onSelectStoryId: (storyId: string) => void;
}>(function Tree({
  isBrowsing,
  isMain,
  refId,
  data,
  docsMode,
  highlightedRef,
  setHighlightedItemId,
  selectedStoryId,
  onSelectStoryId,
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Find top-level nodes and group them so we can hoist any orphans and expand any roots.
  const [rootIds, orphanIds, initialExpanded] = useMemo(
    () =>
      Object.keys(data).reduce<[string[], string[], ExpandedState]>(
        (acc, id) => {
          const item = data[id];
          if (item.type === 'root') acc[0].push(id);
          else if (!item.parent) acc[1].push(id);
          if (item.type === 'root' && item.startCollapsed) acc[2][id] = false;
          return acc;
        },
        [[], [], {}]
      ),
    [data]
  );

  // Create a map of expandable descendants for each root/orphan item, which is needed later.
  // Doing that here is a performance enhancement, as it avoids traversing the tree again later.
  const { expandableDescendants } = useMemo(() => {
    return [...orphanIds, ...rootIds].reduce(
      (acc, nodeId) => {
        acc.expandableDescendants[nodeId] = getDescendantIds(data, nodeId, false).filter(
          (d) => !['story', 'docs'].includes(data[d].type)
        );
        return acc;
      },
      { orphansFirst: [] as string[], expandableDescendants: {} as Record<string, string[]> }
    );
  }, [data, rootIds, orphanIds]);

  // Create a list of component IDs which should be collapsed into their (only) child.
  // That is:
  //  - components with a single story child with the same name
  //  - components with only a single docs child
  const singleStoryComponentIds = useMemo(() => {
    return Object.keys(data).filter((id) => {
      const entry = data[id];
      if (entry.type !== 'component') return false;

      const { children = [], name } = entry;
      if (children.length !== 1) return false;

      const onlyChild = data[children[0]];

      if (onlyChild.type === 'docs') return true;
      if (onlyChild.type === 'story') return isStoryHoistable(onlyChild.name, name);
      return false;
    });
  }, [data]);

  // Omit single-story components from the list of nodes.
  const collapsedItems = useMemo(() => {
    return Object.keys(data).filter((id) => !singleStoryComponentIds.includes(id));
  }, [singleStoryComponentIds]);

  // Rewrite the dataset to place the child story in place of the component.
  const collapsedData = useMemo(() => {
    return singleStoryComponentIds.reduce(
      (acc, id) => {
        const { children, parent, name } = data[id] as ComponentEntry;
        const [childId] = children;
        if (parent) {
          const siblings = [...(data[parent] as GroupEntry).children];
          siblings[siblings.indexOf(id)] = childId;
          acc[parent] = { ...data[parent], children: siblings } as GroupEntry;
        }
        acc[childId] = {
          ...data[childId],
          name,
          parent,
          depth: data[childId].depth - 1,
        } as StoryEntry;
        return acc;
      },
      { ...data }
    );
  }, [data]);

  const ancestry = useMemo(() => {
    return collapsedItems.reduce(
      (acc, id) => Object.assign(acc, { [id]: getAncestorIds(collapsedData, id) }),
      {} as { [key: string]: string[] }
    );
  }, [collapsedItems, collapsedData]);

  // Track expanded nodes, keep it in sync with props and enable keyboard shortcuts.
  const [expanded, setExpanded] = useExpanded({
    containerRef,
    isBrowsing,
    refId,
    data: collapsedData,
    initialExpanded,
    rootIds,
    highlightedRef,
    setHighlightedItemId,
    selectedStoryId,
    onSelectStoryId,
  });

  return (
    <Container ref={containerRef} hasOrphans={isMain && orphanIds.length > 0}>
      {collapsedItems.map((itemId) => {
        const item = collapsedData[itemId];
        const id = createId(itemId, refId);

        if (item.type === 'root') {
          const descendants = expandableDescendants[item.id];
          const isFullyExpanded = descendants.every((d: string) => expanded[d]);
          return (
            // @ts-expect-error (TODO)
            <Root
              key={id}
              item={item}
              refId={refId}
              isOrphan={false}
              isDisplayed
              isSelected={selectedStoryId === itemId}
              isExpanded={!!expanded[itemId]}
              setExpanded={setExpanded}
              isFullyExpanded={isFullyExpanded}
              expandableDescendants={descendants}
              onSelectStoryId={onSelectStoryId}
            />
          );
        }

        const isDisplayed = !item.parent || ancestry[itemId].every((a: string) => expanded[a]);
        return (
          <Node
            key={id}
            item={item}
            refId={refId}
            docsMode={docsMode}
            isOrphan={orphanIds.some((oid) => itemId === oid || itemId.startsWith(`${oid}-`))}
            isDisplayed={isDisplayed}
            isSelected={selectedStoryId === itemId}
            isExpanded={!!expanded[itemId]}
            setExpanded={setExpanded}
            onSelectStoryId={onSelectStoryId}
          />
        );
      })}
    </Container>
  );
});
