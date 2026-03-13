import React, {useMemo} from 'react';
import styled from 'styled-components';
import {Link, useLocation} from 'wouter';
import PANES from '../../utils/pane-config';
import {useAppSelector} from 'src/store/hooks';
import {getShowDesignTab} from 'src/store/settingsSlice';
import {FontAwesomeIcon} from '@fortawesome/react-fontawesome';
import {faUsers, faCircleInfo} from '@fortawesome/free-solid-svg-icons';
import {CategoryMenuTooltip} from '../inputs/tooltip';
import {CategoryIconContainer} from '../panes/grid';
import {ErrorLink, ErrorsPaneConfig} from '../panes/errors';
import {ExternalLinks} from './external-links';
import {useTranslation} from 'react-i18next';
import {LanguageSelect} from './language-select';

const Container = styled.div`
  width: 100vw;
  height: 25px;
  padding: 12px 0;
  border-bottom: 1px solid var(--border_color_cell);
  display: flex;
  align-items: center;
  justify-content: center;
`;

const {DEBUG_PROD, MODE, DEV} = import.meta.env;
const showDebugPane = MODE === 'development' || DEBUG_PROD === 'true' || DEV;

const GlobalContainer = styled(Container)`
  background: var(--bg_outside-accent);
  column-gap: 20px;
`;

export const UnconnectedGlobalMenu = () => {
  const {t, i18n} = useTranslation();
  const showDesignTab = useAppSelector(getShowDesignTab);

  const [location] = useLocation();

  const Panes = useMemo(() => {
    return PANES.filter((pane) => pane.key !== ErrorsPaneConfig.key).map(
      (pane) => {
        if (pane.key === 'design' && !showDesignTab) return null;
        if (pane.key === 'debug' && !showDebugPane) return null;
        return (
          <Link key={pane.key} to={pane.path}>
            <CategoryIconContainer $selected={pane.path === location}>
              <FontAwesomeIcon size={'xl'} icon={pane.icon} />
              <CategoryMenuTooltip>{t(pane.title)}</CategoryMenuTooltip>
            </CategoryIconContainer>
          </Link>
        );
      },
    );
  }, [location, showDesignTab]);

  return (
    <React.Fragment>
      <GlobalContainer>
        <ErrorLink />
        {Panes}
        <Link to="/community">
          <CategoryIconContainer $selected={location === '/community'}>
            <FontAwesomeIcon size={'xl'} icon={faUsers} />
            <CategoryMenuTooltip>{t('Community')}</CategoryMenuTooltip>
          </CategoryIconContainer>
        </Link>
        <Link to="/about">
          <CategoryIconContainer $selected={location === '/about'}>
            <FontAwesomeIcon size={'xl'} icon={faCircleInfo} />
            <CategoryMenuTooltip>{t('About')}</CategoryMenuTooltip>
          </CategoryIconContainer>
        </Link>
        <LanguageSelect />
        <ExternalLinks />
      </GlobalContainer>
    </React.Fragment>
  );
};
