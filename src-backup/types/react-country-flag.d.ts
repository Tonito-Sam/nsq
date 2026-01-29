declare module 'react-country-flag' {
  import * as React from 'react';
  interface Props extends React.SVGProps<SVGElement> {
    countryCode: string;
    svg?: boolean;
    svgStyle?: React.CSSProperties;
    style?: React.CSSProperties;
    title?: string;
    className?: string;
  }
  const ReactCountryFlag: React.FC<Props>;
  export default ReactCountryFlag;
}
