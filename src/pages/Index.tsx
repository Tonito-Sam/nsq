
import React from 'react';
import { Feed } from '../components/Feed';
import { Layout } from '../components/Layout';
import { ShowProvider } from '../contexts/ShowContext';

const Index = () => {
  return (
    <ShowProvider>
      <Layout>
        <Feed />
      </Layout>
    </ShowProvider>
  );
};

export default Index;
