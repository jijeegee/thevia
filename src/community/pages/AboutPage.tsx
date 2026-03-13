// TheVIA About page
// Introduces the project and community features

import React from 'react';
import styled from 'styled-components';

// ── Styled components ──────────────────────────────────────────────

const PageContainer = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 48px 24px;
  min-height: calc(100vh - 50px);
  background: var(--bg_gradient);
  color: var(--color_label);
  overflow-y: auto;
`;

const Title = styled.h1`
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 8px 0;
  color: var(--color_label-highlighted);
`;

const Subtitle = styled.p`
  font-size: 16px;
  color: var(--color_label);
  margin: 0 0 40px 0;
  text-align: center;
  max-width: 600px;
  line-height: 1.6;
`;

const Section = styled.section`
  max-width: 700px;
  width: 100%;
  margin-bottom: 32px;
`;

const SectionTitle = styled.h2`
  font-size: 20px;
  font-weight: 600;
  margin: 0 0 12px 0;
  color: var(--color_label-highlighted);
`;

const SectionText = styled.p`
  font-size: 14px;
  line-height: 1.7;
  margin: 0 0 16px 0;
  color: var(--color_label);
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 16px;
  width: 100%;
  max-width: 700px;
  margin-bottom: 40px;
`;

const FeatureCard = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 20px;
  border: 1px solid var(--border_color_cell);
  border-radius: 8px;
  background: var(--bg_control);
`;

const FeatureIcon = styled.span`
  font-size: 24px;
`;

const FeatureName = styled.span`
  font-size: 14px;
  font-weight: 600;
  color: var(--color_label-highlighted);
`;

const FeatureDesc = styled.span`
  font-size: 13px;
  line-height: 1.5;
  color: var(--color_label);
`;

const LinkList = styled.div`
  display: flex;
  gap: 16px;
  flex-wrap: wrap;
`;

const ExternalLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border: 1px solid var(--border_color_cell);
  border-radius: 6px;
  background: var(--bg_control);
  color: var(--color_label-highlighted);
  font-size: 13px;
  text-decoration: none;
  transition: border-color 0.15s ease;

  &:hover {
    border-color: var(--color_accent);
  }
`;

// ── Component ──────────────────────────────────────────────────────

export const AboutPage: React.FC = () => {
  return (
    <PageContainer>
      <Title>TheVIA</Title>
      <Subtitle>
        A community-enhanced fork of VIA that extends keyboard support through
        crowd-sourced definitions, trust scoring, and collaborative curation.
      </Subtitle>

      <FeatureGrid>
        <FeatureCard>
          <FeatureIcon>{'\uD83D\uDD0D'}</FeatureIcon>
          <FeatureName>Auto-Match</FeatureName>
          <FeatureDesc>
            Automatically searches the community database when your keyboard
            is not in the official VIA list.
          </FeatureDesc>
        </FeatureCard>
        <FeatureCard>
          <FeatureIcon>{'\u2B06'}</FeatureIcon>
          <FeatureName>Community Upload</FeatureName>
          <FeatureDesc>
            Upload VIA JSON definitions for your keyboard to help others with
            the same board.
          </FeatureDesc>
        </FeatureCard>
        <FeatureCard>
          <FeatureIcon>{'\u2705'}</FeatureIcon>
          <FeatureName>Trust Scoring</FeatureName>
          <FeatureDesc>
            Definitions are ranked by community votes and successful usage
            sessions for safety and reliability.
          </FeatureDesc>
        </FeatureCard>
      </FeatureGrid>

      <Section>
        <SectionTitle>How It Works</SectionTitle>
        <SectionText>
          When you connect a keyboard that VIA does not recognize, TheVIA
          automatically queries the community database for matching JSON
          definitions. If a match is found, it is loaded with a notification
          bar showing trust information. You can vote on definitions to help
          the community identify the best ones.
        </SectionText>
        <SectionText>
          If no community definition exists for your keyboard, you can
          upload one yourself. Your contribution helps everyone with the same
          keyboard model.
        </SectionText>
      </Section>

      <Section>
        <SectionTitle>Links</SectionTitle>
        <LinkList>
          <ExternalLink
            href="https://github.com/the-via/app"
            target="_blank"
            rel="noopener noreferrer"
          >
            VIA on GitHub
          </ExternalLink>
          <ExternalLink
            href="https://www.caniusevia.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Can I Use VIA?
          </ExternalLink>
          <ExternalLink
            href="https://thevia.app"
            target="_blank"
            rel="noopener noreferrer"
          >
            TheVIA Community
          </ExternalLink>
        </LinkList>
      </Section>
    </PageContainer>
  );
};
