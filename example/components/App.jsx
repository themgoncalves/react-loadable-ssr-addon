import React from 'react';
import Loadable from 'react-loadable';
import Loading from './Loading';

const HeaderExample = Loadable({
  loader: () => import(/* webpackChunkName: "header" */'./Header'),
  loading: Loading,
});

const ContentExample = Loadable({
  loader: () => import(/* webpackChunkName: "content" */'./Content'),
  loading: Loading,
});

export default function App() {
  return (
    <React.Fragment>
      <HeaderExample />
      <ContentExample />
    </React.Fragment>
  )
}
