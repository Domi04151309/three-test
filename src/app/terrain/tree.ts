import * as THREE from 'three';
import { Tree as BaseTree, TreePreset } from '@dgreenheck/ez-tree';

export type TreePreset = keyof typeof TreePreset;

export class Tree extends THREE.LOD {
  static create(type: TreePreset): Tree {
    const treePrototype = new BaseTree();
    treePrototype.loadPreset(type);
    treePrototype.options.seed = Math.random() * 12_345;
    treePrototype.generate();

    const tree = new Tree();
    tree.addLevel(treePrototype, 0);
    tree.addLevel(new THREE.Object3D(), 480);
    return tree;
  }
}
