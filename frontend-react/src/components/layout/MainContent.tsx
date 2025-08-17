import React from 'react';
import { useAppState } from '../../StateContext';
import StructureView from '../structure/StructureView';
import CompanyView from '../company/CompanyView';
import StrainEditor from '../editor/StrainEditor';
import ShopPlaceholder from '../shop/ShopPlaceholder';

const MainContent: React.FC = () => {
  const { state } = useAppState();
  switch (state.treeMode) {
    case 'structure':
      return <StructureView />;
    case 'company':
      return <CompanyView />;
    case 'editor':
      return <StrainEditor />;
    case 'shop':
    default:
      return <ShopPlaceholder />;
  }
};

export default MainContent;
