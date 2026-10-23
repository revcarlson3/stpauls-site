export type EditorTreeNode = {
  type: string;
  children?: EditorTreeNode[];
};

function blockAtPath<T extends EditorTreeNode>(blocks: T[], path: number[]) {
  let current: T | undefined;
  let children = blocks;
  for (const index of path) {
    current = children[index];
    if (!current) return undefined;
    children = (current.children ?? []) as T[];
  }
  return current;
}

function removeAtPath<T extends EditorTreeNode>(blocks: T[], path: number[]): T[] {
  if (path.length === 1) return blocks.filter((_, index) => index !== path[0]);
  return blocks.map((block, index) => index === path[0] ? { ...block, children: removeAtPath(block.children ?? [], path.slice(1)) } : block);
}

function insertBlockAtPath<T extends EditorTreeNode>(blocks: T[], parentPath: number[], index: number, block: T): T[] {
  if (!parentPath.length) {
    const next = [...blocks];
    next.splice(Math.max(0, Math.min(index, next.length)), 0, block);
    return next;
  }
  return blocks.map((item, itemIndex) => itemIndex === parentPath[0]
    ? { ...item, children: insertBlockAtPath(item.children ?? [], parentPath.slice(1), index, block) }
    : item);
}

export function moveBlockToInsertion<T extends EditorTreeNode>(blocks: T[], sourcePath: number[], targetParentPath: number[], targetIndex: number, structuralTypes: readonly string[]) {
  if (!sourcePath.length || (targetParentPath.length >= sourcePath.length && sourcePath.every((value, index) => targetParentPath[index] === value))) return { blocks, path: sourcePath };
  const source = blockAtPath(blocks, sourcePath);
  if (!source) return { blocks, path: sourcePath };
  const sourceParentPath = sourcePath.slice(0, -1);
  const sourceIndex = sourcePath[sourcePath.length - 1];
  const isSameParent = sourceParentPath.length === targetParentPath.length && sourceParentPath.every((value, index) => targetParentPath[index] === value);
  const next = removeAtPath(blocks, sourcePath);
  const adjustedTargetParentPath = [...targetParentPath];
  if (targetParentPath.length > sourceParentPath.length && sourceParentPath.every((value, index) => targetParentPath[index] === value) && targetParentPath[sourceParentPath.length] > sourceIndex) {
    adjustedTargetParentPath[sourceParentPath.length] -= 1;
  }
  if (adjustedTargetParentPath.length) {
    const targetParent = blockAtPath(next, adjustedTargetParentPath);
    if (!targetParent || !structuralTypes.includes(targetParent.type)) return { blocks, path: sourcePath };
  }
  const adjustedIndex = Math.max(0, targetIndex - (isSameParent && sourceIndex < targetIndex ? 1 : 0));
  const targetChildren = adjustedTargetParentPath.length ? blockAtPath(next, adjustedTargetParentPath)?.children ?? [] : next;
  const actualIndex = Math.min(adjustedIndex, targetChildren.length);
  return { blocks: insertBlockAtPath(next, adjustedTargetParentPath, actualIndex, source), path: [...adjustedTargetParentPath, actualIndex] };
}
