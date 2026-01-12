'use client';

import React from 'react';
import classNames from 'classnames/bind';
import { Modal } from './Modal';
import styles from './ConsentDocumentModal.module.scss';

const cx = classNames.bind(styles);

interface ConsentDocumentModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ConsentDocumentModal({ isOpen, onClose }: ConsentDocumentModalProps) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="개인정보 처리 동의서"
      showCloseButton={true}
    >
      <div className={cx('documentContent')}>
        <h1 className={cx('mainTitle')}>AI와 함께하는 마음건강+ 사업 참여 및 개인정보 처리 동의서</h1>

        <p className={cx('intro')}>
          본 동의서는 귀하의 자녀가 「AI와 함께하는 마음건강+: 연계로 완성하는 통합 돌봄 사업」(이하 &quot;본 사업&quot;)에
          참여하고, 관련하여 전문적인 심리상담 및 관련 서비스를 원활하게 제공받는 데 필요한 사항을 안내하고 동의를 얻기 위해 마련되었습니다.
        </p>

        <p className={cx('intro')}>
          본 사업은 아동의 심리·정서 상태를 조기에 파악하고, 필요 시 전문 심리상담센터 및 치료기관과 연계함으로써 아동의 건강한 성장과
          발달을 지원하는 것을 목적으로 합니다. 사업 참여는 보호자의 자발적인 동의에 의해서만 이루어지며, 동의하지 않더라도 소속 기관
          (지역아동센터 등) 이용에 어떠한 불이익도 없습니다.
        </p>

        <hr className={cx('divider')} />

        <section className={cx('section')}>
          <h2 className={cx('sectionTitle')}>제1조 (사업 개요)</h2>

          <div className={cx('articleContent')}>
            <p><strong>① 사업명</strong> : AI와 함께하는 마음건강+: 연계로 완성하는 통합 돌봄 사업</p>
            <p><strong>② 주관기관</strong> : 예이린 사회적협동조합</p>
            <p><strong>③ 대상</strong> : 본 사업에 참여하는 부산 지역아동센터, 아동양육시설, 공동생활가정, 학교 소속 아동 중 본 사업 참여에 동의한 아동</p>
            <p><strong>④ 주요 내용</strong></p>
            <ol className={cx('orderedList')}>
              <li>AI 기반 아동 마음건강 돌봄 통합 디지털 플랫폼(이하 &quot;AI 플랫폼 시스템&quot;이라 한다)을 통한 아동의 정서·심리 상태 분석</li>
              <li>분석 결과에 따른 고위험군 선별 및 보호자 안내</li>
              <li>보호자 동의 시 전문 심리상담센터 연계 및 바우처를 통한 상담 서비스 제공</li>
              <li>원활한 상담 진행을 위한 소통 지원 및 보호자 대상 양육·정서 지도 가이드 제공</li>
            </ol>
          </div>
        </section>

        <hr className={cx('divider')} />

        <section className={cx('section')}>
          <h2 className={cx('sectionTitle')}>제2조 (개인정보 수집·이용 및 제공에 대한 동의)</h2>

          <p className={cx('sectionIntro')}>
            본 사업의 원활한 수행을 위해 「개인정보 보호법」 등 관련 법령에 따라 아래와 같이 개인정보를 수집·이용하고 제3자에게 제공하고자 합니다.
          </p>

          <h3 className={cx('subsectionTitle')}>1. 개인정보 수집·이용 동의 (필수)</h3>
          <p className={cx('note')}>※ 민감정보는 아래 2항에서 별도 동의</p>

          <div className={cx('tableWrapper')}>
            <table className={cx('table')}>
              <thead>
                <tr>
                  <th>수집·이용 목적</th>
                  <th>수집·이용 항목</th>
                  <th>보유 및 이용 기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <ul className={cx('tableList')}>
                      <li>사업 참여 아동 식별 및 관리</li>
                      <li>상담 연계 및 일정 조율</li>
                      <li>보호자와의 원활한 소통 및 안내</li>
                      <li>사업 진행 안내 및 결과 통보</li>
                    </ul>
                  </td>
                  <td>
                    (아동) 성명, 생년월일, 소속 기관<br />
                    (보호자) 성명, 전화번호
                  </td>
                  <td>사업 종료일(2027. 02. 28.)로부터 2년간 보관 후 파기</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className={cx('subsectionTitle')}>2. 민감정보 처리 동의 (필수)</h3>

          <div className={cx('tableWrapper')}>
            <table className={cx('table')}>
              <thead>
                <tr>
                  <th>처리 목적</th>
                  <th>처리 항목 (민감정보)</th>
                  <th>보유 및 이용 기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <ul className={cx('tableList')}>
                      <li>AI 플랫폼 시스템을 통한 심리·정서 상태 분석</li>
                      <li>고위험군 선별 및 전문 상담 연계 여부 판단</li>
                    </ul>
                    <p className={cx('tableNote')}>(AI 플랫폼 시스템 「내 친구 소울이」와의 대화 내용, 감정 상태, 행동 패턴 등을 포함)</p>
                  </td>
                  <td>
                    <ul className={cx('tableList')}>
                      <li>아동의 건강, 심리·정서 상태에 관한 정보</li>
                      <li>AI 플랫폼 시스템 분석 결과</li>
                    </ul>
                  </td>
                  <td>사업 종료일(2027. 02. 28.)로부터 2년간 보관 후 파기</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className={cx('subsectionTitle')}>3. 개인정보 제3자 제공 동의 (필수)</h3>

          <div className={cx('tableWrapper')}>
            <table className={cx('table')}>
              <thead>
                <tr>
                  <th>제공받는 자</th>
                  <th>제공 목적</th>
                  <th>제공 항목</th>
                  <th>보유 및 이용 기간</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>연계된 전문 심리상담센터</td>
                  <td>
                    <ul className={cx('tableList')}>
                      <li>초기 면담 및 심리상담 서비스 제공</li>
                      <li>상담 일정 조율 및 관리</li>
                    </ul>
                  </td>
                  <td>성명, 연락처, 심리·정서 상태 관련 최소한의 정보(상담 연계 필요 여부 등)</td>
                  <td>상담 서비스 제공 기간 동안 보유 후 파기</td>
                </tr>
                <tr>
                  <td>부산사회서비스원 및 아동권리보장원 등의 바우처 시스템 정책시행기관</td>
                  <td>바우처 자격 심사 및 서비스 비용 정산</td>
                  <td>성명, 생년월일 등 바우처 운영에 필요한 정보</td>
                  <td>관련 규정에 따름</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className={cx('warning')}>
            ※ 귀하는 위와 같은 개인정보(민감정보 포함) 수집·이용 및 제3자 제공에 대한 동의를 거부할 권리가 있습니다.
            다만, 본 사업 수행에 필수적인 정보이므로 동의를 거부하실 경우 사업 참여 및 관련 서비스 제공이 제한될 수 있습니다.
          </p>
        </section>

        <hr className={cx('divider')} />

        <section className={cx('section')}>
          <h2 className={cx('sectionTitle')}>제3조 (심리상담 및 바우처 이용 안내)</h2>

          <ol className={cx('orderedList')}>
            <li>
              아동의 상태 및 보호자 동의에 따라 부산광역시 사회서비스원 및 아동권리보장원 등의 바우처 시스템 정책시행기관의
              바우처 사업(아동청소년 심리치유서비스 등)과 연계하여 전문 심리상담이 제공될 수 있습니다.
            </li>
            <li>
              바우처 유형 및 보호자의 소득 수준 등 자격 기준에 따라 일부 자부담금이 발생할 수 있으며,
              이 경우 사전에 구체적인 내용을 안내해 드립니다.
            </li>
            <li>
              보호자는 자부담금 발생 여부 및 금액을 확인한 후 상담 이용 여부를 최종 결정할 수 있습니다.
            </li>
          </ol>
        </section>

        <hr className={cx('divider')} />

        <section className={cx('section')}>
          <h2 className={cx('sectionTitle')}>제4조 (기타 사항)</h2>

          <div className={cx('articleContent')}>
            <p>
              <strong>① 동의의 철회</strong>: 보호자는 언제든지 본 동의의 전부 또는 일부를 철회할 수 있습니다.
              동의 철회 시 해당 시점부터 관련 서비스 제공이 중단될 수 있으나, 이미 진행된 상담 및 사업 참여에 대해서는 효력이 미치지 않습니다.
              동의 철회는 사업 참여 기관(지역아동센터 등) 또는 주관기관(예이린 사회적협동조합)을 통해 서면으로 요청할 수 있으며,
              주관기관은 지체 없이 개인정보 파기 등 필요한 조치를 취합니다.
            </p>
            <p>
              <strong>② 수집 데이터의 활용</strong>: 본 사업을 통해 수집된 아동의 개인정보 및 심리·정서 데이터는 개인을 특정할 수 없도록
              비식별화 조치 후, 사업 성과 분석, AI 솔루션 성능 개선 및 관련 연구를 위한 통계 자료로 활용될 수 있습니다.
            </p>
            <p>
              <strong>③ 연구 결과물의 권리 귀속</strong>: 비식별화된 데이터를 활용하여 생성된 통계 자료, 연구 보고서, AI 모델 개선 결과 등
              2차적 저작물에 대한 지식재산권은 주관기관인 예이린 사회적협동조합에 귀속됩니다. 다만, 개인을 식별할 수 있는 원본 개인정보에 대한
              권리는 정보주체에게 있으며, 주관기관은 이를 위 목적 외로 사용하지 않습니다.
            </p>
            <p>
              <strong>④ 분쟁 해결</strong>: 본 동의서 및 사업 참여와 관련하여 분쟁이 발생하는 경우, 당사자 간 상호 협의하여 원만히 해결하기 위해 노력하며,
              합의가 이루어지지 않을 경우 부산지방법원을 제1심 관할법원으로 하여 해결합니다.
            </p>
            <p>
              <strong>⑤ 개인정보의 파기</strong>: 주관기관은 개인정보의 보유기간이 경과하거나 처리목적이 달성된 경우 지체 없이 해당 개인정보를 파기합니다.
              파기 방법은 다음과 같습니다.
            </p>
            <ul className={cx('unorderedList')}>
              <li>전자적 파일 형태의 개인정보: 복원이 불가능한 방법으로 영구 삭제</li>
              <li>종이 문서 형태의 개인정보: 파쇄 또는 소각</li>
            </ul>
            <p>
              <strong>⑥ 문의처</strong>: 본 사업 및 개인정보 처리에 관한 문의는 아래 연락처로 연락 주시기 바랍니다.
            </p>
            <ul className={cx('unorderedList', 'contactInfo')}>
              <li>기관명: 예이린 사회적협동조합</li>
              <li>개인정보 보호책임자: 박지영</li>
              <li>연락처: 051-890-6079</li>
              <li>주소: 부산 해운대구 달맞이길117번다길 42-8</li>
            </ul>
          </div>
        </section>

        <hr className={cx('divider')} />

        <section className={cx('section')}>
          <h2 className={cx('sectionTitle')}>【 동의 확인 】</h2>

          <p className={cx('consentIntro')}>
            본인은 상기 내용을 모두 충분히 숙지하고 이해하였으며, 자녀의 「AI와 함께하는 마음건강+」 사업 참여 및
            아래 각 항목의 개인정보 처리에 관하여 자발적으로 동의합니다.
          </p>
          <p className={cx('note')}>※ 만 14세 이상 아동의 경우, 아동 본인의 동의도 함께 받습니다.</p>

          <div className={cx('consentTable')}>
            <div className={cx('consentRow', 'header')}>
              <div className={cx('consentItem')}>동의 항목</div>
              <div className={cx('consentChoice')}>동의함</div>
              <div className={cx('consentChoice')}>동의하지 않음</div>
            </div>
            <div className={cx('consentRow')}>
              <div className={cx('consentItem')}>개인정보 수집·이용 및 제3자 제공에 동의합니다. (필수)</div>
              <div className={cx('consentChoice')}>[ ]</div>
              <div className={cx('consentChoice')}>[ ]</div>
            </div>
            <div className={cx('consentRow')}>
              <div className={cx('consentItem')}>민감정보(건강, 심리·정서 상태 등) 처리에 동의합니다. (필수)</div>
              <div className={cx('consentChoice')}>[ ]</div>
              <div className={cx('consentChoice')}>[ ]</div>
            </div>
            <div className={cx('consentRow')}>
              <div className={cx('consentItem')}>비식별화된 데이터의 연구 활용 및 2차적 저작물 권리 귀속에 동의합니다. (선택)</div>
              <div className={cx('consentChoice')}>[ ]</div>
              <div className={cx('consentChoice')}>[ ]</div>
            </div>
          </div>

          <p className={cx('note')}>※ 본 항목에 동의하지 않아도 사업 참여에는 영향이 없습니다.</p>
        </section>

        <div className={cx('closeButtonSection')}>
          <button type="button" onClick={onClose} className={cx('closeBtn')}>
            닫기
          </button>
        </div>
      </div>
    </Modal>
  );
}
